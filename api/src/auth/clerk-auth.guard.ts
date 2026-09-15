import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';

import { ApiException } from '../common/api-exception';
import { ENV, type Env } from '../config/config.module';

import type { AuthedRequest } from './auth.types';
import { ClerkService } from './clerk.service';

/**
 * 401 `{ error: 'Not signed in' }` unless the request carries a valid Clerk
 * session. Attaches `req.userId`.
 *
 * On `azp` (authorized party): Clerk's `authorizedParties` option throws when a
 * token has no `azp` at all (`@clerk/backend` 3.17.2,
 * `assertAuthorizedPartiesClaim`: `if (!azp || !includes(azp))`). Session tokens
 * from the Expo app carry none, so that option would sign every merchant out of
 * the app. Web does not set it either. Instead: a token that DOES name a browser
 * origin must name one of ours; a token with no `azp` is accepted as web accepts
 * it today.
 */
@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    private readonly clerk: ClerkService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();

    const session = await this.clerk.verify(req);
    if (!session) throw new ApiException(401, 'Not signed in');

    const allowed = this.env.CLERK_AUTHORIZED_PARTIES;
    if (session.azp && allowed.length > 0 && !allowed.includes(session.azp)) {
      throw new ApiException(401, 'Not signed in');
    }

    req.userId = session.userId;
    return true;
  }
}
