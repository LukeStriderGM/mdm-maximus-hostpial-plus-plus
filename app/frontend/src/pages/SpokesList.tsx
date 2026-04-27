import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getSpokes } from "../lib/api";
import { NodeCard } from "../components/ui/NodeCard";
import { Spinner } from "../components/ui/Spinner";

export function SpokesList() {
  const navigate = useNavigate();
  const { data: spokes, isLoading } = useQuery({ queryKey: ["spokes"], queryFn: () => getSpokes() });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Spokes</h2>
      <div className="grid grid-cols-3 gap-4">
        {spokes?.map((spoke) => (
          <NodeCard
            key={spoke.id} name={spoke.name} type="spoke"
            status={spoke.status as "operational"}
            itemCount={spoke.inventory_count}
            onClick={() => navigate(`/spokes/${spoke.id}`)}
          />
        ))}
        {spokes?.length === 0 && <p className="text-text-secondary col-span-3">No spokes registered. Upload data to get started.</p>}
      </div>
    </div>
  );
}
