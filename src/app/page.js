"use client";

import { useState, useRef, useEffect } from "react";

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async (queryOverride) => {
    const query = queryOverride || input;
    if (!query.trim() || isLoading) return;

    const userMessage = { role: "user", text: query };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
      const response = await fetch(`${backendUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "bot", text: data.error || "An error occurred.", type: "ERROR" }
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { 
            role: "bot", 
            text: data.answer, 
            type: data.type,
            source_url: data.source_url,
            last_updated: data.last_updated
          }
        ]);
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: "Network error. Please try again later.", type: "ERROR" }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-surface-deep text-on-surface font-body-lg h-screen flex overflow-hidden">
      <input className="hidden" id="sidebar-toggle" type="checkbox" />
      
      {/* SideNavBar */}
      <aside className="hidden md:flex w-[280px] transition-all duration-300 ease-in-out h-screen flex-shrink-0 flex-col py-gutter px-4 bg-surface-container-low border-r border-border-subtle relative z-20">
        <div className="flex items-center gap-3 mb-4 justify-between px-collapsed justify-center-collapsed">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0"></div>
            <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface hide-collapsed whitespace-nowrap">groww-factor</h1>
          </div>
        </div>
        <p className="font-body-sm text-body-sm text-text-muted mb-6 hide-collapsed">Factual intelligence for HDFC Mutual Fund analysis.</p>
        
        <button 
          onClick={() => setMessages([])}
          className="w-full bg-primary-container text-on-primary-container py-3 px-4 rounded-full font-bold flex items-center justify-center gap-2 mb-8 hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined shrink-0" style={{fontVariationSettings: "'FILL' 0"}}>add</span>
          <span className="hide-collapsed whitespace-nowrap">New Chat</span>
        </button>

        <div className="flex-1 overflow-y-auto overflow-x-hidden hide-scrollbar">
          <h2 className="font-label-caps text-label-caps text-text-muted mb-2 px-3 flex items-center gap-2 hide-collapsed">
            <span className="material-symbols-outlined text-[16px] shrink-0" style={{fontVariationSettings: "'FILL' 0"}}>bar_chart</span>
            SUPPORTED FUNDS
          </h2>
          <nav className="space-y-1">
            {["HDFC Large Cap Fund", "HDFC Mid-Cap Fund", "HDFC Small Cap Fund", "HDFC Gold ETF FoF", "HDFC Silver ETF FoF"].map(fund => (
              <a key={fund} className="flex items-center gap-3 px-3 py-2 text-text-muted hover:text-on-surface-variant hover:bg-surface-bright/10 transition-colors duration-200 rounded-lg justify-center-collapsed group relative" href="#" title={fund}>
                <span className="material-symbols-outlined shrink-0 hidden group-[.justify-center-collapsed]:block" style={{fontVariationSettings: "'FILL' 0"}}>show_chart</span>
                <span className="font-body-sm text-body-sm hide-collapsed whitespace-nowrap">{fund}</span>
              </a>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative bg-surface-deep overflow-hidden">
        <div className="absolute inset-0 bg-dots pointer-events-none"></div>
        
        {/* TopAppBar */}
        <header className="w-full h-16 flex items-center justify-between w-full px-gutter z-10 bg-transparent">
          <div className="flex items-center gap-4">
            <label className="cursor-pointer p-2 rounded-full hover:bg-surface-bright/50 transition-colors flex items-center justify-center text-text-muted hover:text-on-surface md:block hidden" htmlFor="sidebar-toggle">
              <span className="material-symbols-outlined">menu</span>
            </label>
            <span className="font-title-md text-title-md font-bold">Compliance Chat</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-surface-container-high px-3 py-1.5 rounded-full border border-border-subtle text-text-muted font-body-sm text-body-sm">
              <span className="w-2 h-2 rounded-full bg-verified-green animate-pulse"></span>
              Facts Verified
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-gutter pb-32 flex flex-col items-center relative z-10 hide-scrollbar">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center w-full">
              <div className="text-center max-w-2xl mx-auto mb-12">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary mx-auto mb-6 flex items-center justify-center"></div>
                <h2 className="font-display-lg text-display-lg font-bold mb-4">How can I help you today?</h2>
                <p className="font-body-lg text-body-lg text-text-muted">I provide strict, compliance-verified data sourced directly from official fund documents.</p>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-4xl mx-auto flex flex-col gap-6">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'user' ? (
                    <div className="max-w-[85%] bg-primary/10 border border-primary/30 text-on-surface p-4 rounded-2xl rounded-tr-sm">
                      <p className="font-body-lg text-body-lg whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  ) : (
                    <div className={`max-w-[85%] bg-surface-container border ${msg.type === 'ADVISORY_REFUSAL' ? 'border-warning/50' : 'border-border-subtle'} text-on-surface p-5 rounded-2xl rounded-tl-sm relative`}>
                      <span className="absolute -top-3 -left-3 bg-surface-container border border-border-subtle rounded-full w-8 h-8 flex items-center justify-center overflow-hidden">
                         <div className="w-full h-full bg-gradient-to-br from-primary to-secondary"></div>
                      </span>
                      <p className="font-body-lg text-body-lg whitespace-pre-wrap">{msg.text}</p>
                      
                      {/* Citation Footer */}
                      {msg.source_url && (
                        <div className="mt-4 pt-3 border-t border-border-subtle flex flex-col gap-1">
                          <a href={msg.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary hover:text-primary-fixed transition-colors font-body-sm text-body-sm">
                            <span className="material-symbols-outlined text-[16px]">link</span>
                            Source (Groww Factsheet)
                          </a>
                          {msg.last_updated && (
                            <span className="text-text-muted font-body-sm text-body-sm">
                              Last updated: {new Date(msg.last_updated).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex w-full justify-start">
                  <div className="max-w-[85%] bg-surface-container border border-border-subtle p-5 rounded-2xl rounded-tl-sm flex items-center gap-2">
                    <div className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 p-container-margin bg-gradient-to-t from-surface-deep via-surface-deep to-transparent z-20">
          <div className="max-w-4xl mx-auto relative flex items-center gap-3">
            <input 
              className="w-full bg-surface-container-high border border-border-subtle rounded-full py-4 pl-6 pr-14 font-body-lg text-body-lg text-on-surface placeholder-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-50" 
              placeholder="Ask a factual question about HDFC schemes..." 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              maxLength={500}
            />
            <button 
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim()}
              className="absolute right-3 p-2 rounded-full text-text-muted hover:text-primary hover:bg-surface-bright transition-colors flex items-center justify-center disabled:opacity-50 disabled:hover:text-text-muted disabled:hover:bg-transparent"
            >
              <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 0"}}>send</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
