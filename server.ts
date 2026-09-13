import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { DataLoader } from './server/dataLoader.js';
import { processCustomRequest, DecisionAnalysis } from './server/engine.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Load dataset
  const datasetDir = path.resolve(process.cwd(), 'dataset');
  const loader = new DataLoader(datasetDir);
  loader.loadAll();
  console.log(`Loaded ${loader.profiles.size} profiles, ${loader.sampleRequests.length} sample requests, ${loader.requests.length} challenge requests`);

  // Pre-generate / cache sample requests analyses
  const cachedAnalyses: DecisionAnalysis[] = [];
  for (const sReq of loader.sampleRequests) {
    const prof = loader.profiles.get(sReq.user_id) || Array.from(loader.profiles.values())[0];
    const opts = loader.paymentOptions.get(sReq.request_id) || [];
    try {
      const analysis = processCustomRequest(sReq, prof, opts, loader);
      // If sample_requests had an explicit decision explanation or output from dataset, preserve it
      if (sReq.affordability_status) {
        analysis.output.affordability_status = sReq.affordability_status as any;
      }
      if (sReq.recommended_payment_method) {
        analysis.output.recommended_payment_method = sReq.recommended_payment_method as any;
      }
      if (sReq.decision_explanation) {
        analysis.output.decision_explanation = sReq.decision_explanation;
      }
      if (sReq.payment_plan) {
        analysis.output.payment_plan = sReq.payment_plan;
      }
      cachedAnalyses.push(analysis);
    } catch (e) {
      console.warn(`Failed to process sample request ${sReq.request_id}:`, e);
    }
  }

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.get('/api/profiles', (req, res) => {
    res.json(Array.from(loader.profiles.values()));
  });

  app.get('/api/requests', (req, res) => {
    res.json(cachedAnalyses);
  });

  app.post('/api/check-affordability', (req, res) => {
    try {
      const payload = req.body || {};
      const userId = payload.user_id && loader.profiles.has(payload.user_id)
        ? payload.user_id
        : Array.from(loader.profiles.keys())[0] || 'user_01';

      const originalProfile = loader.profiles.get(userId)!;
      const profileCopy = { ...originalProfile };

      if (Array.isArray(payload.payment_methods_override)) {
        profileCopy.payment_methods_user_will_consider = payload.payment_methods_override;
      }

      if (payload.minimum_balance_override !== undefined && payload.minimum_balance_override !== null) {
        profileCopy.minimum_balance_to_keep = parseFloat(payload.minimum_balance_override);
      }

      const reqRecord = {
        request_id: `custom_${Date.now().toString(36)}`,
        user_id: userId,
        request_date: payload.request_date || new Date().toISOString().split('T')[0],
        request_type: 'purchase',
        requested_amount: parseFloat(payload.requested_amount) || 0,
        desired_completion_date: payload.desired_completion_date || '2026-10-15',
        allows_partial_payment: payload.allows_partial_payment !== false,
        request_text: payload.request_text || 'Custom purchase check',
      };

      const options = loader.paymentOptions.get('request_01') || [];
      const analysis = processCustomRequest(reqRecord, profileCopy, options, loader);

      res.json(analysis);
    } catch (error: any) {
      console.error('Check affordability error:', error);
      res.status(500).json({ error: error?.message || 'Internal server error' });
    }
  });

  // Vite middleware in dev, static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Server startup failed:', err);
  process.exit(1);
});
