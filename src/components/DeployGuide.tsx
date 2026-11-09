import React, { useState } from 'react';
import { Terminal, Copy, Check, ExternalLink, ShieldCheck, Server } from 'lucide-react';

export const DeployGuide: React.FC = () => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const envTemplate = `# Render & Local Production Environment (.env)
APP_ENV=production
PORT=8000
APP_API_TOKEN=jarvis_prod_secret_token_change_me
ALLOW_NO_AUTH=false

# Provider Order & Fallback Chain
LLM_PROVIDER_ORDER=llm7,pollinations,groq,gemini,openai,claude

# Keyless Free Fallback Providers
LLM_POLLINATIONS_MODEL=openai
LLM_LLM7_MODEL=gpt-oss:20b

# Commercial Providers (Set whichever you have)
GROQ_API_KEY=
GEMINI_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Google Integrations
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
DEFAULT_TIMEZONE=Asia/Kolkata

# Persistence
SQLITE_PATH=jarvis.db
KEEPALIVE_ENABLED=true
PING_INTERVAL_SECONDS=240
`;

  const copySnippet = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="h-[calc(100vh-60px)] overflow-y-auto p-6 max-w-5xl mx-auto w-full text-slate-200 font-mono space-y-6">
      <div className="border-b border-cyan-900/30 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Server className="w-5 h-5 text-cyan-400" />
            <span>Render Deployment &amp; Environment Setup</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Instructions to deploy the upgraded JARVIS backend on Render using the included render.yaml blueprint.
          </p>
        </div>
      </div>

      {/* Render Troubleshooting Alert for yarn start */}
      <div className="p-4 bg-amber-950/40 border border-amber-500/50 rounded-lg space-y-2">
        <div className="text-xs font-bold text-amber-300 flex items-center gap-2 uppercase tracking-wider">
          <span>Troubleshooting: "error Command 'start' not found" on Render</span>
        </div>
        <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
          <p>
            <strong>Why this happened:</strong> Render detected a Node.js repository and executed <code className="text-amber-200">yarn start</code>, but the original project lacked a <code className="text-cyan-300">"start"</code> script.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-[11px]">
            <div className="p-3 bg-[#030610] rounded border border-cyan-950">
              <span className="text-cyan-400 font-bold block mb-1">Option A: Deploying this Web Studio (Node)</span>
              <span className="text-slate-400">
                Fixed! <code className="text-cyan-300">"start": "node server.js"</code> has now been added to <code className="text-cyan-300">package.json</code>, backed by Express production server. Redploying on Render will now succeed automatically.
              </span>
            </div>
            <div className="p-3 bg-[#030610] rounded border border-cyan-950">
              <span className="text-cyan-400 font-bold block mb-1">Option B: Deploying JARVIS Python Backend</span>
              <span className="text-slate-400">
                Fixed in root! <code className="text-cyan-300">requirements.txt</code>, <code className="text-cyan-300">app.py</code>, and all Python modules have been placed directly in the repository root directory. <code className="text-amber-200">pip install -r requirements.txt</code> will now succeed immediately on Render. If your files are in a subfolder, either set Render's <strong>Root Directory</strong> setting to that folder name, or use <code className="text-amber-200">pip install -r requirements.txt</code> at root.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4-Step Checklist */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
        <div className="p-4 bg-[#08101e] border border-cyan-900/30 rounded-lg space-y-2">
          <div className="text-cyan-400 font-bold">01. Extract or Push</div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Download the upgraded ZIP, extract it, and push the repository to GitHub.
          </p>
        </div>
        <div className="p-4 bg-[#08101e] border border-cyan-900/30 rounded-lg space-y-2">
          <div className="text-cyan-400 font-bold">02. New Blueprint</div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            On Render dashboard, click <strong>New &gt; Blueprint</strong> and select the repository containing <code className="text-cyan-300">render.yaml</code>.
          </p>
        </div>
        <div className="p-4 bg-[#08101e] border border-cyan-900/30 rounded-lg space-y-2">
          <div className="text-cyan-400 font-bold">03. Add Secrets</div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Add <code className="text-cyan-300">APP_API_TOKEN</code> and any provider keys in the Render environment variables tab.
          </p>
        </div>
        <div className="p-4 bg-[#08101e] border border-cyan-900/30 rounded-lg space-y-2">
          <div className="text-cyan-400 font-bold">04. Self-KeepAlive</div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            The built-in <code className="text-cyan-300">keepalive.py</code> loop automatically pings the service every 240 seconds to prevent cold starts.
          </p>
        </div>
      </div>

      {/* Environment Config Generator */}
      <div className="p-4 bg-[#08101e] border border-cyan-900/30 rounded-lg space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-cyan-300 flex items-center gap-2 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Recommended .env Configuration</span>
          </div>
          <button
            onClick={() => copySnippet('env', envTemplate)}
            className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 cursor-pointer"
          >
            {copiedKey === 'env' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedKey === 'env' ? 'Copied' : 'Copy .env Template'}</span>
          </button>
        </div>
        <pre className="p-3 bg-[#030610] rounded border border-cyan-950 text-xs overflow-x-auto text-slate-300 leading-5">
          {envTemplate}
        </pre>
      </div>

      {/* Curl Validation Tests */}
      <div className="p-4 bg-[#08101e] border border-cyan-900/30 rounded-lg space-y-3">
        <div className="text-xs font-semibold text-cyan-300 flex items-center gap-2 uppercase tracking-wider">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span>Verification Curl Commands</span>
        </div>
        <div className="space-y-3 text-xs">
          <div className="p-3 bg-[#030610] rounded border border-cyan-950 space-y-1">
            <div className="text-[11px] text-slate-400">1. Health check:</div>
            <code className="text-cyan-300 block select-all">
              curl -s https://&lt;your-render-url&gt;.onrender.com/health
            </code>
          </div>
          <div className="p-3 bg-[#030610] rounded border border-cyan-950 space-y-1">
            <div className="text-[11px] text-slate-400">2. Live chat test:</div>
            <code className="text-cyan-300 block select-all">
              curl -s -X POST https://&lt;your-render-url&gt;.onrender.com/api/chat \
                -H "Content-Type: application/json" \
                -H "X-API-Token: &lt;YOUR_TOKEN&gt;" \
                -d '{'{'}"message": "Hello JARVIS, test system parameters."{'}'}'
            </code>
          </div>
        </div>
      </div>
    </div>
  );
};
