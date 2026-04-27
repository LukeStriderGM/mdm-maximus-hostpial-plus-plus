import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getHubs } from "../lib/api";
import { NodeCard } from "../components/ui/NodeCard";
import { Spinner } from "../components/ui/Spinner";

export function HubsList() {
  const navigate = useNavigate();
  const { data: hubs, isLoading } = useQuery({ queryKey: ["hubs"], queryFn: getHubs });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Hubs</h2>
      <div className="grid grid-cols-3 gap-4">
        {hubs?.map((hub) => (
          <NodeCard
            key={hub.id} name={hub.name} type="hub"
            status={hub.status as "operational"}
            itemCount={hub.inventory_count}
            onClick={() => navigate(`/hubs/${hub.id}`)}
          />
        ))}
        {hubs?.length === 0 && <p className="text-text-secondary col-span-3">No hubs registered. Upload data to get started.</p>}
      </div>
    </div>
  );
}
