import path from 'path';
import express, { type Express } from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import { corsOptions } from './config/cors';
import { requestLogger } from './middleware/requestLogger';
import { requestId } from './middleware/requestId';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';
import { maintenanceGuard } from './middleware/maintenance';
import { ipBlockGuard } from './middleware/ipBlock';
import routes from './routes';

const app: Express = express();

// Trust first proxy (needed for correct req.ip behind reverse proxies like Nginx, load balancers)
app.set('trust proxy', 1);

// ── Widget routes (before Helmet to avoid CSP blocking inline scripts) ──

// Serve webchat widget JS (CORS open for embedding on any site)
app.get('/widget.js', cors(), (_req, res) => {
  res.sendFile(path.resolve(__dirname, '../../../packages/widget/dist/mojeeb-widget.js'));
});

// Serve chat page for widget iframe (CORS open)
app.get('/chat', cors(), (_req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/chat.html'));
});

// Widget test page (development only)
if (process.env.NODE_ENV !== 'production') {
app.get('/widget-test', cors(), (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="UTF-8"><title>Widget Test</title></head>
<body style="font-family:sans-serif;padding:40px">
  <h1>Widget Test</h1>
  <p>Chat bubble should appear bottom-right.</p>

  <script id="mojeeb-chat-widget"
    src="/widget.js"
    data-channel-id="cmlfc0rti0007unjcfp3l4wu3"
    data-mode="default"
    data-config='{"direction":"rtl"}'>
  </script>
</body>
</html>`);
});
}

// ── Compression ──
app.use(compression());

// ── Security middleware ──
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      frameSrc: ["'self'"],
      frameAncestors: ["'self'"],  // Widget routes are served before helmet, so they bypass CSP
    },
  },
  crossOriginEmbedderPolicy: false,  // Needed for cross-origin resources
  crossOriginResourcePolicy: { policy: 'cross-origin' },  // Allow serving static files cross-origin
}));

// Serve uploaded files AFTER Helmet (so security headers like X-Content-Type-Options apply)
app.use('/uploads', cors(), express.static(path.resolve(__dirname, '../uploads')));
app.use(cors(corsOptions));
// CSRF: Not needed — all auth uses Authorization Bearer header, no cookie-based auth

// Allow all origins for webchat API endpoints (widget embedded on customer sites)
app.use('/api/v1/webchat', cors());

// Body parsing
app.use(express.json({
  limit: '10mb',
  verify: (req: any, _res, buf) => {
    // Preserve raw body for webhook signature verification
    if (req.originalUrl?.startsWith('/api/v1/webhooks')) {
      req.rawBody = buf;
    }
  },
}));
app.use(express.urlencoded({ extended: true }));

// Request ID tracing
app.use(requestId);

// Request logging
app.use(requestLogger);

// Rate limiting
app.use('/api/v1', apiLimiter);

// IP block guard (before maintenance and API routes)
app.use(ipBlockGuard);

// Maintenance mode guard
app.use(maintenanceGuard);

// API routes
app.use('/api/v1', routes);

// Error handling
app.use(errorHandler);

export default app;
