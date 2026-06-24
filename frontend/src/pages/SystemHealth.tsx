export default function SystemHealth() {
  return (
    <div className="flex h-[calc(100vh-140px)] items-center justify-center border border-white/10 rounded-2xl bg-white/5">
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold">System Health</h2>
        <p className="text-muted-foreground">Monitor Docker containers, RAM, CPU.</p>
      </div>
    </div>
  );
}
