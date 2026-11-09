import React, { useState } from 'react';
import { Smartphone, Copy, Check, Shield, Cpu, Code2, Radio } from 'lucide-react';

export const AndroidSpecGuide: React.FC = () => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copySnippet = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const sseClientSnippet = `// Android SSE Streaming Chat Client (Kotlin / OkHttp)
class JarvisStreamRepository(private val client: OkHttpClient, private val backendUrl: String) {
    fun streamChat(message: String, token: String, onToken: (String) -> Unit, onAction: (JSONObject) -> Unit) {
        val jsonPayload = JSONObject().apply {
            put("message", message)
            put("provider", "auto")
            put("stream", true)
        }
        val request = Request.Builder()
            .url("$backendUrl/api/chat/stream")
            .addHeader("X-API-Token", token)
            .addHeader("Accept", "text/event-stream")
            .post(jsonPayload.toString().toRequestBody("application/json".toMediaType()))
            .build()

        val eventSource = EventSources.createFactory(client).newEventSource(request, object : EventSourceListener() {
            override fun onEvent(eventSource: EventSource, id: String?, type: String?, data: String) {
                val json = JSONObject(data)
                when (json.optString("type")) {
                    "token" -> onToken(json.getString("token"))
                    "actions" -> {
                        val actions = json.getJSONArray("actions")
                        for (i in 0 until actions.length()) {
                            onAction(actions.getJSONObject(i))
                        }
                    }
                    "done" -> { /* stream complete */ }
                }
            }
        })
    }
}`;

  const intentDispatcherSnippet = `// Android Local Intent & AlarmManager Dispatcher
fun executeDeviceAction(context: Context, action: JSONObject) {
    when (action.getString("action")) {
        "set_timer" -> {
            val seconds = action.getInt("seconds")
            val intent = Intent(AlarmClock.ACTION_SET_TIMER).apply {
                putExtra(AlarmClock.EXTRA_LENGTH, seconds)
                putExtra(AlarmClock.EXTRA_MESSAGE, action.optString("label", "JARVIS Timer"))
                putExtra(AlarmClock.EXTRA_SKIP_UI, false)
            }
            context.startActivity(intent)
        }
        "set_alarm" -> {
            val intent = Intent(AlarmClock.ACTION_SET_ALARM).apply {
                putExtra(AlarmClock.EXTRA_MESSAGE, "JARVIS Alarm")
                putExtra(AlarmClock.EXTRA_SKIP_UI, false)
            }
            context.startActivity(intent)
        }
        "open_app" -> {
            val app = action.getString("app")
            val launchIntent = context.packageManager.getLaunchIntentForPackage(appPackageMap[app] ?: app)
            launchIntent?.let { context.startActivity(it) }
        }
    }
}`;

  return (
    <div className="h-[calc(100vh-60px)] overflow-y-auto p-6 max-w-5xl mx-auto w-full text-slate-200 font-mono space-y-6">
      <div className="border-b border-cyan-900/30 pb-4">
        <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-cyan-400" />
          <span>Prompt 2 — JARVIS Android APK Architecture Contract</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Technical specifications for building the Android client in Kotlin &amp; Jetpack Compose to interface with the v2.0 backend.
        </p>
      </div>

      {/* Permissions Matrix */}
      <div className="p-4 bg-[#08101e] border border-cyan-900/30 rounded-lg space-y-3">
        <div className="text-xs font-semibold text-cyan-300 flex items-center gap-2 uppercase tracking-wider">
          <Shield className="w-4 h-4 text-cyan-400" />
          <span>Android Manifest Runtime Permissions</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-[#040814] border border-cyan-950 rounded">
            <span className="text-cyan-400 font-bold block mb-1">android.permission.RECORD_AUDIO</span>
            <span className="text-slate-400 text-[11px]">
              Microphone activation for real-time speech recognition via Android SpeechRecognizer.
            </span>
          </div>
          <div className="p-3 bg-[#040814] border border-cyan-950 rounded">
            <span className="text-cyan-400 font-bold block mb-1">com.android.alarm.permission.SET_ALARM</span>
            <span className="text-slate-400 text-[11px]">
              Allows the device to trigger native alarms &amp; countdown timers dispatched by JARVIS.
            </span>
          </div>
          <div className="p-3 bg-[#040814] border border-cyan-950 rounded">
            <span className="text-cyan-400 font-bold block mb-1">android.permission.ACCESS_FINE_LOCATION</span>
            <span className="text-slate-400 text-[11px]">
              Authorized single-query location context for navigation intents.
            </span>
          </div>
          <div className="p-3 bg-[#040814] border border-cyan-950 rounded">
            <span className="text-cyan-400 font-bold block mb-1">android.permission.INTERNET</span>
            <span className="text-slate-400 text-[11px]">
              HTTPS network transport for SSE chat streaming and backend REST endpoints.
            </span>
          </div>
        </div>
      </div>

      {/* SSE Code Snippet */}
      <div className="p-4 bg-[#08101e] border border-cyan-900/30 rounded-lg space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-cyan-300 flex items-center gap-2 uppercase tracking-wider">
            <Radio className="w-4 h-4 text-cyan-400" />
            <span>SSE Streaming Chat Client (Kotlin / OkHttp)</span>
          </div>
          <button
            onClick={() => copySnippet('sse', sseClientSnippet)}
            className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
          >
            {copiedKey === 'sse' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedKey === 'sse' ? 'Copied' : 'Copy Code'}</span>
          </button>
        </div>
        <pre className="p-3 bg-[#030610] rounded border border-cyan-950 text-xs overflow-x-auto text-slate-300 leading-5">
          {sseClientSnippet}
        </pre>
      </div>

      {/* Device Intent Dispatcher Snippet */}
      <div className="p-4 bg-[#08101e] border border-cyan-900/30 rounded-lg space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-cyan-300 flex items-center gap-2 uppercase tracking-wider">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>Intent &amp; AlarmManager Action Handler (Kotlin)</span>
          </div>
          <button
            onClick={() => copySnippet('intent', intentDispatcherSnippet)}
            className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
          >
            {copiedKey === 'intent' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedKey === 'intent' ? 'Copied' : 'Copy Code'}</span>
          </button>
        </div>
        <pre className="p-3 bg-[#030610] rounded border border-cyan-950 text-xs overflow-x-auto text-slate-300 leading-5">
          {intentDispatcherSnippet}
        </pre>
      </div>
    </div>
  );
};
