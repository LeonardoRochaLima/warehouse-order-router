import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { RoutingEngine } from './routing.engine';
import { RoutingRunner } from './routing.runner';

@Module({
  imports: [OrdersModule],
  providers: [RoutingEngine, RoutingRunner],
  exports: [RoutingEngine, RoutingRunner],
})
export class RoutingModule {}
