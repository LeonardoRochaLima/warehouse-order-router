import { Module } from '@nestjs/common';
import { OrderAssemblerService } from './order-assembler.service';

@Module({
  providers: [OrderAssemblerService],
  exports: [OrderAssemblerService],
})
export class OrdersModule {}
