import { Global, Module } from '@nestjs/common';

import { CloudinaryService } from './cloudinary.service';
import { PaystackService } from './paystack.service';

@Global()
@Module({
  providers: [PaystackService, CloudinaryService],
  exports: [PaystackService, CloudinaryService],
})
export class IntegrationsModule {}
