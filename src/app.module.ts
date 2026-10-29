import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DataModule } from './data/data.module';
import { OrdersModule } from './orders/orders.module';
import { RoutingModule } from './routing/routing.module';

@Module({
  imports: [
    // D-20: DATA_DIR / OUTPUT_FILE from env or an optional .env file; no secrets
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    DataModule,
    OrdersModule,
    RoutingModule,
  ],
})
export class AppModule {}
