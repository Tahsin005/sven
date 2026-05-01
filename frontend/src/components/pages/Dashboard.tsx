import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { createClient } from "@/lib/supabase/client";
import { BACKEND_URL } from "@/env";
import { askSven, type StreamResponse } from "@/lib/api";
import { ArrowRight, Search, Globe, Library } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "PENDING" | "COMPLETED";
  sources?: { url: string }[];
  followUps?: string[];
}

const supabase = createClient();

export default function Dashboard() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const [jwt, setJwt] = useState("");
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setJwt(session.access_token);
      } else {
        navigate("/auth");
      }
    });
  }, [navigate]);

  useEffect(() => {
    if (conversationId && jwt) {
      fetch(`${BACKEND_URL}/conversations/${conversationId}`, {
        headers: { Authorization: jwt }
      })
      .then(res => res.json())
      .then(data => {
        if (data.messages) {
          setMessages(data.messages.map((m: any) => {
             let text = m.content;
             let followUps: string[] | undefined = undefined;
             if (m.role === 'assistant') {
                 const answerMatch = text.match(/<ANSWER>([\s\S]*?)(?:<\/ANSWER>|$)/);
                 if (answerMatch && answerMatch[1]) text = answerMatch[1].trim();
                 else {
                     // Fallback cleanup
                     text = text
                      .replace(/<CONVERSATION_ID>[\s\S]*?<\/CONVERSATION_ID>/g, "")
                      .replace(/<MESSAGE_ID>[\s\S]*?<\/MESSAGE_ID>/g, "")
                      .replace(/<SOURCES>[\s\S]*?(?:<\/SOURCES>|$)/g, "")
                      .replace(/<FOLLOW_UPS>[\s\S]*?(?:<\/FOLLOW_UPS>|$)/g, "")
                      .replace(/<ANSWER>/g, "")
                      .replace(/<\/ANSWER>/g, "").trim();
                 }

                 const followUpsMatch = m.content.match(/<FOLLOW_UPS>([\s\S]*?)(?:<\/FOLLOW_UPS>|$)/);
                 if (followUpsMatch && followUpsMatch[1]) {
                    const questionsStr = followUpsMatch[1];
                    const questionMatches = [...questionsStr.matchAll(/<question>([\s\S]*?)(?:<\/question>|$)/g)];
                    followUps = questionMatches.map(qm => qm[1] ? qm[1].trim() : "").filter(Boolean);
                 }
             }

             return {
                id: String(m.id),
                role: m.role,
                content: text,
                status: m.status,
                sources: m.sources,
                followUps
             };
          }));
        }
      })
      .catch(err => console.error("Failed to load chat history:", err));
    } else {
      setMessages([]);
    }
  }, [conversationId, jwt]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const submitQuery = async (textToSubmit: string) => {
    if (!textToSubmit.trim() || isStreaming) return;

    const userQuery = textToSubmit.trim();
    setQuery("");
    
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: userQuery, status: "COMPLETED" };
    const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: "assistant", content: "", status: "PENDING" };
    
    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    try {
      await askSven(userQuery, jwt, conversationId, (data: StreamResponse) => {
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            if (data.messageId) lastMsg.id = data.messageId;
            lastMsg.content = data.text;
            if (data.sources) lastMsg.sources = data.sources;
            if (data.followUps) lastMsg.followUps = data.followUps;
          }
          return newMessages;
        });

        if (!conversationId && data.conversationId) {
          navigate(`/c/${data.conversationId}`, { replace: true });
        }
      });
      
      setMessages(prev => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            lastMsg.status = "COMPLETED";
          }
          return newMessages;
      });
    } catch (error) {
      console.error(error);
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMsg = newMessages[newMessages.length - 1];
        if (lastMsg && lastMsg.role === "assistant") {
          lastMsg.content = "Sorry, an error occurred while fetching the response.";
        }
        return newMessages;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    submitQuery(query);
  };

  if (!conversationId && messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full max-w-3xl mx-auto mt-24 px-4 w-full">
        <h1 className="text-3xl font-semibold mb-8 text-foreground">Where knowledge begins</h1>
        <form 
          onSubmit={handleSubmit}
          className="w-full relative flex items-center shadow-lg rounded-full border border-border bg-card overflow-hidden focus-within:ring-1 focus-within:ring-ring focus-within:border-ring transition-all"
        >
          <div className="pl-4 text-muted-foreground">
            <Search size={20} />
          </div>
          <input 
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything..."
            className="flex-1 p-4 bg-transparent outline-none border-none text-foreground"
          />
          <button 
            type="submit" 
            disabled={!query.trim()}
            className="m-2 p-2 bg-primary text-primary-foreground rounded-full disabled:opacity-50 transition-colors"
          >
            <ArrowRight size={20} />
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto px-4 py-8 relative">
      <div className="flex-1 overflow-y-auto space-y-10 pb-40 scrollbar-hide">
        {messages.map((msg, idx) => (
          <div key={msg.id} className="flex flex-col space-y-4">
            {msg.role === "user" ? (
              <div className="flex justify-end">
                <div className="bg-secondary text-secondary-foreground px-6 py-4 rounded-3xl max-w-[85%] sm:max-w-[75%] shadow-sm border border-border/50">
                  <h2 className="text-xl font-medium">{msg.content}</h2>
                </div>
              </div>
            ) : (
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center shrink-0">
                  <Library size={18} className="text-primary" />
                </div>
                <div className="flex-1 space-y-4 min-w-0">
                  <div className="text-base text-foreground/90 leading-relaxed space-y-4 prose prose-invert max-w-none">
                    {msg.content ? (
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    ) : (
                      msg.status === "PENDING" ? <span className="animate-pulse">Thinking...</span> : ""
                    )}
                  </div>
                  
                  {msg.followUps && msg.followUps.length > 0 && (
                    <div className="mt-6 space-y-3">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        Related
                      </h3>
                      <div className="flex flex-col gap-2">
                        {msg.followUps.map((q, idx) => (
                          <div 
                            key={idx}
                            className="px-4 py-3 rounded-lg border border-border/50 bg-secondary/30 text-sm text-foreground"
                          >
                            {q}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-8 space-y-2 pt-6 border-t border-border/50">
                      <p className="text-sm font-semibold flex items-center gap-2 text-foreground">
                        <Globe size={16} className="text-muted-foreground" />
                        Sources
                      </p>
                      <div className="flex flex-wrap gap-2 pb-2">
                        {msg.sources.map((src, i) => {
                          try {
                             const hostname = new URL(src.url).hostname.replace("www.", "");
                             return (
                               <a key={i} href={src.url} target="_blank" rel="noreferrer" className="flex flex-col bg-card border border-border rounded-lg p-3 text-xs hover:bg-secondary/50 transition-colors w-[150px] overflow-hidden">
                                  <span className="font-semibold text-foreground truncate">{hostname}</span>
                                  <span className="text-muted-foreground truncate">{src.url}</span>
                               </a>
                             )
                          } catch(e) { return null }
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/90 to-transparent flex justify-center pb-8">
        <form 
          onSubmit={handleSubmit}
          className="w-full max-w-3xl relative flex items-center shadow-[0_0_15px_rgba(0,0,0,0.1)] rounded-full border border-border bg-card overflow-hidden focus-within:ring-1 focus-within:ring-ring transition-all"
        >
          <div className="pl-4 text-muted-foreground">
            <Search size={20} />
          </div>
          <input 
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a follow-up..."
            className="flex-1 p-4 bg-transparent outline-none border-none text-foreground placeholder:text-muted-foreground"
            disabled={isStreaming}
          />
          <button 
            type="submit" 
            disabled={!query.trim() || isStreaming}
            className="m-2 p-2 bg-primary text-primary-foreground rounded-full disabled:opacity-50 transition-colors"
          >
            <ArrowRight size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}