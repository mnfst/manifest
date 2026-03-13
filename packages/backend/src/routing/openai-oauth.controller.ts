import { Controller, Get, Query, Req, Res, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.instance';
import { OpenaiOauthService } from './openai-oauth.service';
import { ResolveAgentService } from './resolve-agent.service';

@Controller('api/v1/oauth/openai')
export class OpenaiOauthController {
  private readonly logger = new Logger(OpenaiOauthController.name);

  constructor(
    private readonly oauthService: OpenaiOauthService,
    private readonly resolveAgent: ResolveAgentService,
  ) {}

  /**
   * Generates an OpenAI OAuth authorize URL with PKCE challenge.
   * The frontend opens this URL in a popup window.
   * A temporary callback server on port 1455 handles the redirect.
   */
  @Get('authorize')
  async authorize(
    @Query('agentName') agentName: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const agent = await this.resolveAgent.resolve(user.id, agentName);
    const backendUrl = `${req.protocol}://${req.get('host')}`;
    const url = this.oauthService.generateAuthorizationUrl(agent.id, user.id, backendUrl);
    return { url };
  }

  /**
   * Completion page served on the main backend's origin.
   * The port-1455 callback server redirects here after token exchange
   * so that postMessage reaches the opener (same origin).
   */
  @Get('done')
  @Public()
  done(@Query('ok') ok: string, @Res() res: Response) {
    const success = ok === '1';
    const message = success ? 'manifest-oauth-success' : 'manifest-oauth-error';
    const text = success
      ? 'Login successful! This window will close automatically.'
      : 'Login failed. Please close this window and try again.';

    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
<html>
<head><title>Manifest — OpenAI Login</title></head>
<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#111;color:#eee;">
<p>${text}</p>
<script>
if(window.opener){window.opener.postMessage({type:'${message}'},'*');}
setTimeout(function(){window.close();},2000);
</script>
</body>
</html>`);
  }
}
