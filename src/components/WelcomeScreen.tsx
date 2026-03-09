import { memo, useMemo, useCallback } from 'react';
import { useAppStore, type Connection } from '../store/useAppStore';
import { Button } from '@/components/ui/button';
import { Zap, Database, ArrowRight } from 'lucide-react';

const WelcomeScreen = memo(function WelcomeScreen() {
  const connections = useAppStore(s => s.connections);
  const setShowConnectionDialog = useAppStore(s => s.setShowConnectionDialog);

  const recentConnections = useMemo(() => connections.slice(0, 2), [connections]);

  const handleConnect = useCallback((conn: Connection) => {
    window.dispatchEvent(new CustomEvent('vibedb:connect', { detail: conn }));
  }, []);

  return (
    <>
      {/* Decorative background glow - fixed position to avoid recalc during sidebar resize */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <div className="w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] will-change-transform" />
      </div>
      
      <div className="flex-1 flex items-center justify-center p-8 bg-background relative overflow-hidden">
      
      <div className="max-w-md w-full z-10 animate-fade-in">
        <div className="flex items-center justify-center w-20 h-20 rounded-md bg-primary/10 text-primary mb-8 mx-auto border border-primary/30">
          <Zap size={40} />
        </div>
        
        <h1 className="text-5xl font-extrabold text-center mb-4 tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-foreground to-muted-foreground">
          VibeDB
        </h1>
        
        <p className="text-center text-muted-foreground mb-12 text-sm leading-relaxed max-w-[320px] mx-auto font-medium">
          Open source database management. Beautiful, fast, and built for
          developers. Start by connecting to a database.
        </p>

        <div className="flex justify-center mb-16">
          <Button
            size="lg"
            className="px-8 h-12 text-sm font-semibold tracking-wide transition-transform hover:scale-[1.02]"
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
                  className="flex items-center p-4 rounded-md bg-secondary/30 border border-border/60 cursor-pointer hover:bg-secondary hover:border-primary/50 transition-all group"
                  onClick={() => handleConnect(conn)}
                >
                  <div className="w-12 h-12 rounded-sm bg-background flex items-center justify-center mr-4 group-hover:text-primary transition-colors border border-border shadow-sm">
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
    </>
  );
});

export default WelcomeScreen;
