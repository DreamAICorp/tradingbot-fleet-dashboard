import FleetHeader from '@/components/fleet/FleetHeader';
import ChampionTable from '@/components/fleet/ChampionTable';
import LiqHeatmap from '@/components/fleet/LiqHeatmap';
import CapitalAllocationPie from '@/components/fleet/CapitalAllocationPie';
import RunnerHealthTable from '@/components/fleet/RunnerHealthTable';
import CorrelationMatrix from '@/components/fleet/CorrelationMatrix';

export default function Dashboard() {
  return (
    <>
      <FleetHeader />
      <ChampionTable />

      <div style={{ marginTop: 24 }}>
        <LiqHeatmap />
      </div>

      <div style={{ marginTop: 24 }}>
        <CapitalAllocationPie />
      </div>

      <div style={{ marginTop: 24 }}>
        <RunnerHealthTable />
      </div>

      <div style={{ marginTop: 24 }}>
        <CorrelationMatrix />
      </div>
    </>
  );
}
