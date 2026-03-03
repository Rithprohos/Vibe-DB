import { useAppStore } from '../store/useAppStore';
import { Button } from '@/components/ui/button';
import { Zap, Database, ArrowRight } from 'lucide-react';

export default function WelcomeScreen() {
  const { connections, setShowConnectionDialog } = useAppStore();

  const recentConnections = connections.slice(0, 5);

  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-background relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="max-w-md w-full z-10 animate-fade-in">
        <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 text-primary mb-8 mx-auto shadow-glow border border-primary/20">
          <Zap size={40} className="animate-pulse" />
        </div>
        
        <h1 className="text-5xl font-extrabold text-center mb-4 tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-foreground to-muted-foreground">
          VibeDB
        </h1>
        
        <p className="text-center text-muted-foreground mb-12 text-sm leading-relaxed max-w-[320px] mx-auto font-medium">
          Open source database management. Beautiful, fast, and built for
          developers. Start by connecting to a SQLite database.
        </p>

        <div className="flex justify-center mb-16">
          <Button
            size="lg"
            className="rounded-full shadow-glow px-8 h-14 text-base font-semibold transition-transform hover:scale-105"
            onClick={() => setShowConnectionDialog(true)}
          >
            <Zap size={20} className="mr-2" />
            New Connection
          </Button>
        </div>

        {recentConnections.length > 0 && (
          <div className="space-y-4 animate-slide-up" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
            <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-center mb-6">
              Recent Connections
            </h3>
            <div className="grid gap-3">
              {recentConnections.map((conn) => (
                <div
                  key={conn.id}
                  className="flex items-center p-4 rounded-xl bg-secondary/30 border border-border/50 cursor-pointer hover:bg-secondary hover:border-primary/50 hover:shadow-[0_0_15px_rgba(0,229,153,0.1)] transition-all group"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent('vibedb:connect', { detail: conn })
                    );
                  }}
                >
                  <div className="w-12 h-12 rounded-lg bg-background flex items-center justify-center mr-4 group-hover:text-primary transition-colors border border-border shadow-sm">
                    <Database size={20} />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="font-semibold text-sm text-foreground mb-1 truncate">{conn.name}</div>
                    <div className="text-xs text-muted-foreground truncate font-mono opacity-80">{conn.path}</div>
                  </div>
                  <ArrowRight size={18} className="text-muted-foreground opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-primary transition-all duration-300" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
