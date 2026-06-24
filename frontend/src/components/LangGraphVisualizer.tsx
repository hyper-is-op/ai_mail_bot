import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Brain, HelpCircle, Database, Search, CheckCircle, Send, AlertTriangle, Info } from 'lucide-react';

interface Node {
  id: string;
  label: string;
  desc: string;
  x: number;
  y: number;
  icon: any;
  color: string;
}

const NODES: Node[] = [
  { id: "Start", label: "Start", desc: "Incoming customer support email received and queued", x: 60, y: 160, icon: Mail, color: "from-blue-500 to-indigo-500" },
  { id: "Intent_Detection", label: "Intent Classifier", desc: "LLM parses inquiry to extract intent category, customer sentiment, and priority level", x: 220, y: 160, icon: Brain, color: "from-purple-500 to-pink-500" },
  { id: "Clarification_Request", label: "Clarification Loop", desc: "Sent when query contains multiple ambiguous ticket reference IDs", x: 420, y: 50, icon: HelpCircle, color: "from-yellow-500 to-amber-500" },
  { id: "Order_Check", label: "CRM Lookup", desc: "Checks order database or docket status webhook using extracted ticket ID", x: 420, y: 160, icon: Database, color: "from-cyan-500 to-blue-500" },
  { id: "RAG_Search", label: "RAG Knowledge Check", desc: "Queries vector database using text embeddings to retrieve policy docs", x: 420, y: 270, icon: Search, color: "from-emerald-500 to-teal-500" },
  { id: "Confidence_Evaluation", label: "Confidence Guard", desc: "Heuristic and LLM scoring module. Verifies draft response matches target confidence threshold", x: 630, y: 270, icon: CheckCircle, color: "from-orange-500 to-red-500" },
  { id: "SMTP_Send", label: "SMTP Dispatch", desc: "Dispatches the generated resolution reply directly to user via email client API", x: 820, y: 100, icon: Send, color: "from-green-500 to-emerald-500" },
  { id: "Ticket_Escalation", label: "CRM Escalation", desc: "Creates support ticket on MySQL DB, registers ticket history, and sends confirmation", x: 820, y: 220, icon: AlertTriangle, color: "from-rose-500 to-red-600" }
];

const EDGES = [
  { from: "Start", to: "Intent_Detection" },
  { from: "Intent_Detection", to: "Clarification_Request" },
  { from: "Intent_Detection", to: "Order_Check" },
  { from: "Intent_Detection", to: "RAG_Search" },
  { from: "Order_Check", to: "SMTP_Send" },
  { from: "Order_Check", to: "Ticket_Escalation" },
  { from: "RAG_Search", to: "Confidence_Evaluation" },
  { from: "Confidence_Evaluation", to: "SMTP_Send" },
  { from: "Confidence_Evaluation", to: "Ticket_Escalation" }
];

interface VisualizerProps {
  executionSteps?: string[];
}

export default function LangGraphVisualizer({ executionSteps = ["Start"] }: VisualizerProps) {
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);

  const steps = Array.isArray(executionSteps) ? executionSteps : ["Start"];

  // Determine if a node was executed in the path
  const isNodeActive = (nodeId: string) => {
    return steps.includes(nodeId);
  };

  // Determine if an edge was traversed (consecutive items in steps)
  const isEdgeActive = (from: string, to: string) => {
    for (let i = 0; i < steps.length - 1; i++) {
      if (steps[i] === from && steps[i + 1] === to) {
        return true;
      }
    }
    return false;
  };

  // Generate cubic Bezier path between two points
  const getBezierPath = (x1: number, y1: number, x2: number, y2: number) => {
    const controlX = x1 + (x2 - x1) / 2;
    return `M ${x1} ${y1} C ${controlX} ${y1}, ${controlX} ${y2}, ${x2} ${y2}`;
  };

  return (
    <div className="glass-panel p-5 rounded-2xl border border-white/10 bg-zinc-950/40 relative overflow-hidden select-none">
      {/* Grid Pattern Background */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #ffffff 1.5px, transparent 1.5px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary animate-pulse" />
          <div>
            <h4 className="text-sm font-semibold text-white">Agent Execution Trace</h4>
            <p className="text-[11px] text-muted-foreground">Interactive workflow path taken by the LangGraph parser</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-primary shadow-sm shadow-primary/50" />
            <span>Active Path</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
            <span className="w-2 h-2 rounded-full bg-zinc-700" />
            <span>Unvisited Nodes</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas & Nodes Container */}
      <div className="relative overflow-x-auto overflow-y-hidden py-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <div className="relative min-w-[920px] h-[340px] mx-auto">
          {/* SVG Connection Lines (Edges) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            <defs>
              <linearGradient id="activeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="100%" stopColor="hsl(var(--accent))" />
              </linearGradient>
            </defs>
            {EDGES.map((edge, idx) => {
              const fromNode = NODES.find(n => n.id === edge.from);
              const toNode = NODES.find(n => n.id === edge.to);
              if (!fromNode || !toNode) return null;

              const active = isEdgeActive(edge.from, edge.to);

              // Connect from center-right of source node to center-left of target node
              // Node width is ~155px, height is ~54px
              const startX = fromNode.x + 155;
              const startY = fromNode.y + 27;
              const endX = toNode.x;
              const endY = toNode.y + 27;

              const pathD = getBezierPath(startX, startY, endX, endY);

              return (
                <g key={`edge-${idx}`}>
                  {/* Backdrop path (shadow) */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={active ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)'}
                    strokeWidth={active ? 5 : 2}
                    className="transition-all duration-300"
                  />
                  {/* Active glowing path */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={active ? 'url(#activeGrad)' : 'rgba(255, 255, 255, 0.1)'}
                    strokeWidth={active ? 2 : 1.5}
                    strokeDasharray={active ? '5, 5' : undefined}
                    className={`transition-all duration-300 ${active ? 'animate-flow' : ''}`}
                    style={{
                      strokeDashoffset: active ? 0 : undefined,
                    }}
                  />
                </g>
              );
            })}
          </svg>

          {/* Interactive Nodes */}
          {NODES.map((node) => {
            const active = isNodeActive(node.id);
            const NodeIcon = node.icon;
            const stepIndex = steps.indexOf(node.id);

            return (
              <motion.div
                key={node.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  position: 'absolute',
                  left: node.x,
                  top: node.y,
                  width: '155px',
                  height: '54px'
                }}
                className={`z-10 rounded-xl flex items-center p-3 border transition-all cursor-help select-none ${
                  active 
                    ? `bg-zinc-900/90 border-primary/40 shadow-[0_0_15px_rgba(99,102,241,0.15)]` 
                    : 'bg-zinc-950/60 border-white/5 opacity-40 hover:opacity-75'
                }`}
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {/* Node left color stripe & Icon */}
                <div className={`p-1.5 rounded-lg bg-gradient-to-br ${node.color} mr-2.5 shrink-0 ${active ? 'animate-pulse' : ''}`}>
                  <NodeIcon className="w-3.5 h-3.5 text-white" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-white truncate block">
                      {node.label}
                    </span>
                    {active && (
                      <span className="text-[8px] bg-primary/20 text-primary border border-primary/30 px-1 rounded-md scale-90 select-none">
                        #{stepIndex + 1}
                      </span>
                    )}
                  </div>
                  <span className="text-[8px] text-zinc-400 truncate block mt-0.5">
                    {node.desc}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Styled Flow Animation CSS */}
      <style>{`
        @keyframes flow {
          to {
            stroke-dashoffset: -20;
          }
        }
        .animate-flow {
          animation: flow 1.2s linear infinite;
        }
      `}</style>

      {/* Hover Info Tooltip Panel */}
      <AnimatePresence>
        {hoveredNode && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-4 left-4 right-4 bg-zinc-900/95 border border-white/10 rounded-xl p-3 flex items-start gap-2.5 z-20 shadow-xl backdrop-blur-md"
          >
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div>
              <h5 className="text-xs font-semibold text-white">
                {hoveredNode.label} {isNodeActive(hoveredNode.id) ? '(Executed)' : '(Skipped)'}
              </h5>
              <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                {hoveredNode.desc}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
