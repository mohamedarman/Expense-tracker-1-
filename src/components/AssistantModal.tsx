import React, { useState, useRef, useEffect } from 'react';
import { Send, X } from 'lucide-react';
import { api } from '../api.ts';
import { User } from '../types.ts';

interface AssistantModalProps {
  user: User;
  currency: string;
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  calculation?: string;
}

export const AssistantModal: React.FC<AssistantModalProps> = ({
  currency,
  isOpen,
  onClose,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Ask about your monthly summary, highest expense category, safe daily spend limit, hostel dues, or whether you can afford a specific purchase.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, loading, isOpen]);

  if (!isOpen) return null;

  const quickPrompts = [
    'Monthly summary',
    'Highest expense category',
    'Safe daily spend limit',
    `Can I afford a ${currency}2,000 outing?`,
  ];

  const handleSend = async (questionText?: string) => {
    const q = (questionText ?? input).trim();
    if (!q || loading) return;

    if (!questionText) {
      setInput('');
    }
    const userMsgId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setMessages((prev) => [...prev, { id: userMsgId, role: 'user', text: q }]);
    setLoading(true);

    try {
      const res = await api.askAI(q);
      const replyId = `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setMessages((prev) => [
        ...prev,
        {
          id: replyId,
          role: 'assistant',
          text: res.answer,
          calculation: res.deterministicCalculation,
        },
      ]);
    } catch (err: any) {
      const errId = `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setMessages((prev) => [
        ...prev,
        {
          id: errId,
          role: 'assistant',
          text: `Unable to analyze records: ${err.message || 'Unknown error'}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 font-sans">
      <div className="surface-card rounded-xl max-w-xl w-full max-h-[calc(100dvh-1.5rem)] sm:h-[580px] flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b hairline-border flex items-center justify-between gap-2 surface-deep shrink-0">
          <div className="space-y-0.5 min-w-0">
            <h3 className="text-[15px] font-medium text-ink-primary truncate">
              Budget advisor
            </h3>
            <p className="text-[12px] text-ink-muted truncate">
              Deterministic calculations from your transaction ledger
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close budget advisor"
            className="text-ink-muted hover:text-ink-primary p-1.5 shrink-0 rounded-lg"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 space-y-3 select-text">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[90%] sm:max-w-[85%] min-w-0 rounded-lg p-3 sm:p-3.5 text-[13px] leading-relaxed space-y-2 break-words ${
                  m.role === 'user'
                    ? 'surface-active-row text-ink-primary border hairline-border'
                    : 'surface-deep text-ink-primary border hairline-border'
                }`}
              >
                <div className="whitespace-pre-line break-words">{m.text}</div>
                {m.calculation && (
                  <div className="pt-2 border-t hairline-border text-[11px] sm:text-[12px] font-mono text-ink-secondary tabular-nums break-words">
                    {m.calculation}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="surface-deep border hairline-border rounded-lg px-3.5 py-2.5 text-[12px] font-mono text-ink-muted">
                Computing from ledger...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Question Buttons */}
        <div className="px-3.5 sm:px-4 py-2.5 border-t hairline-border surface-deep flex flex-wrap items-center gap-1.5 shrink-0">
          {quickPrompts.map((qp) => (
            <button
              key={qp}
              type="button"
              onClick={() => handleSend(qp)}
              disabled={loading}
              className="min-h-[28px] px-2.5 py-1 rounded-md btn-secondary text-[12px] text-left leading-tight disabled:opacity-40"
            >
              {qp}
            </button>
          ))}
        </div>

        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-3 border-t hairline-border surface-deep flex items-center gap-2 shrink-0 min-w-0"
        >
          <input
            type="text"
            placeholder="Ask a question about your ledger..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="flex-1 min-w-0 h-9 input-field rounded-lg px-3 text-[13px]"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send question"
            className="h-9 w-9 shrink-0 flex items-center justify-center btn-primary rounded-lg disabled:opacity-40"
          >
            <Send className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </form>
      </div>
    </div>
  );
};
