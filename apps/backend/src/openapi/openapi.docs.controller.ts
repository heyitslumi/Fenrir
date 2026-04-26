import { Controller, Get, Header } from '@nestjs/common';

const OPENAPI_SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'Fenrir OpenAPI v1',
    version: '1.0.0',
    description: 'API-key protected automation endpoints for coins, resources, plans, and moderation.',
  },
  servers: [{ url: '/api/openapi/v1' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'API Key',
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/userinfo': { get: { summary: 'Get user info', parameters: [{ name: 'id', in: 'query', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
    '/setcoins': { post: { summary: 'Set user coins', requestBody: { required: true }, responses: { '200': { description: 'OK' } } } },
    '/addcoins': { post: { summary: 'Add user coins', requestBody: { required: true }, responses: { '200': { description: 'OK' } } } },
    '/setresources': { post: { summary: 'Set user extra resources', requestBody: { required: true }, responses: { '200': { description: 'OK' } } } },
    '/addresources': { post: { summary: 'Add user extra resources', requestBody: { required: true }, responses: { '200': { description: 'OK' } } } },
    '/setplan': { post: { summary: 'Set package/plan', requestBody: { required: true }, responses: { '200': { description: 'OK' } } } },
    '/ban': { post: { summary: 'Ban user', requestBody: { required: true }, responses: { '200': { description: 'OK' } } } },
    '/unban': { post: { summary: 'Unban user', requestBody: { required: true }, responses: { '200': { description: 'OK' } } } },
  },
};

@Controller('openapi')
export class OpenApiDocsController {
  @Get('json')
  getJson() {
    return OPENAPI_SPEC;
  }

  @Get('yml')
  @Header('Content-Type', 'text/yaml; charset=utf-8')
  getYaml() {
    const lines = [
      'openapi: 3.0.3',
      'info:',
      '  title: Fenrir OpenAPI v1',
      '  version: 1.0.0',
      'servers:',
      '  - url: /api/openapi/v1',
      'security:',
      '  - bearerAuth: []',
      'components:',
      '  securitySchemes:',
      '    bearerAuth:',
      '      type: http',
      '      scheme: bearer',
      '      bearerFormat: API Key',
      'paths:',
      '  /userinfo:',
      '    get:',
      '      summary: Get user info',
      '  /setcoins:',
      '    post:',
      '      summary: Set user coins',
      '  /addcoins:',
      '    post:',
      '      summary: Add user coins',
      '  /setresources:',
      '    post:',
      '      summary: Set user extra resources',
      '  /addresources:',
      '    post:',
      '      summary: Add user extra resources',
      '  /setplan:',
      '    post:',
      '      summary: Set package/plan',
      '  /ban:',
      '    post:',
      '      summary: Ban user',
      '  /unban:',
      '    post:',
      '      summary: Unban user',
    ];

    return lines.join('\n');
  }

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  getDocsPage() {
    return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Fenrir OpenAPI Docs</title>
    <style>
      body { font-family: Inter, system-ui, Arial, sans-serif; margin: 32px; }
      code, pre { background: #f5f5f5; padding: 2px 6px; border-radius: 6px; }
      .card { border: 1px solid #ddd; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
      a { color: #2563eb; }
    </style>
  </head>
  <body>
    <h1>Fenrir OpenAPI v1</h1>
    <div class="card">
      <p>Base URL: <code>/api/openapi/v1</code></p>
      <p>Auth header: <code>Authorization: Bearer &lt;openapi.key&gt;</code></p>
      <p>Specs: <a href="/api/openapi/json">JSON</a> · <a href="/api/openapi/yml">YAML</a></p>
    </div>
    <div class="card">
      <p>Available endpoints:</p>
      <pre>GET  /userinfo?id=USER_ID
POST /setcoins
POST /addcoins
POST /setresources
POST /addresources
POST /setplan
POST /ban
POST /unban</pre>
    </div>
  </body>
</html>`;
  }
}
