import { Injectable } from '@nestjs/common';
import { Catalog, RawLine } from '../domain/catalog';
import { Order } from '../domain/order';
import { err, Result } from '../domain/result';
import { EventEnvelopeDto, OrderCreatedDto, OrderEditedDto } from '../data/dto/order-event.dto';
import { validateAs } from '../data/validate';

export const EDIT_WINDOW_MS = 30 * 60 * 1000; // TASK.md §P, D-21

export interface AssembledOrder {
  readonly orderNumber: string;
  /** createdAt ms (Infinity when the created event was malformed, D-26) + file index (D-01) */
  readonly sortKey: { readonly createdAt: number; readonly seq: number };
  readonly order: Result<Order, string>;
}

export interface Assembly {
  readonly orders: AssembledOrder[];
  readonly warnings: string[];
}

interface Draft {
  created: OrderCreatedDto;
  createdAt: number;
  seq: number;
  lines: RawLine[];
}

/** Turns raw events into one routable unit per order, in processing order (R-09, R-10). */
@Injectable()
export class OrderAssemblerService {
  assemble(events: readonly unknown[], catalog: Catalog): Assembly {
    const warnings: string[] = [];
    const drafts = new Map<string, Draft>();
    const broken: AssembledOrder[] = [];
    const edits: { dto: OrderEditedDto; seq: number }[] = [];

    // Pass 1: created events. Every edit must be known before anything is routed (Q-10).
    events.forEach((raw, seq) => {
      const envelope = validateAs(EventEnvelopeDto, raw);
      if (!envelope.ok) return warnings.push(`event[${seq}] ignored: ${envelope.error.join('; ')}`); // D-26
      const { type, orderNumber } = envelope.value;

      if (type === 'order_edited') {
        const edit = validateAs(OrderEditedDto, raw);
        if (!edit.ok) return warnings.push(`event[${seq}] ${orderNumber} edit ignored: ${edit.error.join('; ')}`);
        return edits.push({ dto: edit.value, seq });
      }
      if (type !== 'order_created') return warnings.push(`event[${seq}] ${orderNumber} ignored: unknown type ${type}`); // D-15

      if (drafts.has(orderNumber) || broken.some((b) => b.orderNumber === orderNumber)) {
        return warnings.push(`event[${seq}] ${orderNumber} ignored: duplicate order_created`); // D-15
      }
      const created = validateAs(OrderCreatedDto, raw);
      if (!created.ok) {
        // D-26: still one output line, placed after all well-timed orders
        broken.push({ orderNumber, sortKey: { createdAt: Infinity, seq }, order: err(created.error.join('; ')) });
        return;
      }
      drafts.set(orderNumber, {
        created: created.value,
        createdAt: Date.parse(created.value.at),
        seq,
        lines: [...created.value.lines],
      });
    });

    // Pass 2: fold in edits inside the window (R-09, D-21)
    for (const { dto, seq } of edits) {
      const draft = drafts.get(dto.orderNumber);
      if (!draft) {
        warnings.push(`event[${seq}] ${dto.orderNumber} edit ignored: unknown order`);
        continue;
      }
      const delta = Date.parse(dto.at) - draft.createdAt;
      if (delta < 0 || delta > EDIT_WINDOW_MS) {
        warnings.push(`event[${seq}] ${dto.orderNumber} edit ignored: ${Math.round(delta / 1000)}s after creation (window 0..1800s)`);
        continue;
      }
      draft.lines.push(...dto.addedLines);
    }

    const orders: AssembledOrder[] = [...drafts.values()].map((d) => ({
      orderNumber: d.created.orderNumber,
      sortKey: { createdAt: d.createdAt, seq: d.seq },
      order: Order.create(
        {
          orderNumber: d.created.orderNumber,
          createdAt: new Date(d.createdAt),
          seq: d.seq,
          shipTo: d.created.shipTo,
          lines: d.lines,
        },
        catalog,
      ),
    }));

    // R-10, D-01: by created time, then file order
    const sorted = [...orders, ...broken].sort(
      (a, b) => a.sortKey.createdAt - b.sortKey.createdAt || a.sortKey.seq - b.sortKey.seq,
    );
    return { orders: sorted, warnings };
  }
}
