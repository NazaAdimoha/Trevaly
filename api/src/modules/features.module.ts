import { Module } from '@nestjs/common';

import { CategoriesController } from './catalog/categories.controller';
import { ImportController } from './catalog/import.controller';
import { ProductsController } from './catalog/products.controller';
import { UploadsController } from './catalog/uploads.controller';
import { DeliveryZonesController } from './delivery/delivery-zones.controller';
import { IdentityController } from './identity/identity.controller';
import { InternalController } from './internal/internal.controller';
import { JobsController } from './jobs/jobs.controller';
import { OrdersController } from './orders/orders.controller';
import { FulfillmentService } from './payments/fulfillment.service';
import { PaymentsController } from './payments/payments.controller';
import { WebhookEventsService } from './payments/webhook-events.service';
import { PlatformController } from './platform/platform.controller';
import { CouponsController } from './promotions/coupons.controller';
import { OverviewService } from './stores/overview.service';
import { StoresController } from './stores/stores.controller';
import { StorefrontLayoutController } from './storefront/layout.controller';
import { StorefrontLayoutService } from './storefront/layout.service';
import { StorefrontController } from './storefront/storefront.controller';
import { StorefrontService } from './storefront/storefront.service';

/**
 * Every ported endpoint. One module rather than one per feature: they share
 * the same few services, and none is optional or deployed separately.
 *
 * ImportController is registered before ProductsController so the literal
 * `/products/import` path can never be shadowed by `/products/:id`.
 */
@Module({
  controllers: [
    IdentityController,
    StoresController,
    ImportController,
    ProductsController,
    CategoriesController,
    UploadsController,
    CouponsController,
    DeliveryZonesController,
    OrdersController,
    PlatformController,
    PaymentsController,
    StorefrontController,
    StorefrontLayoutController,
    InternalController,
    JobsController,
  ],
  providers: [
    FulfillmentService,
    WebhookEventsService,
    OverviewService,
    StorefrontService,
    StorefrontLayoutService,
  ],
})
export class FeaturesModule {}
