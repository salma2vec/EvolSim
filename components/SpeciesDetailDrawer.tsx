/**
 * Species detail drawer: trait breakdown, lore, statistics and configured policy
 */

"use client";

import { useSimStore } from "@/lib/store";
import { computeCooperationIndex } from "@/lib/sim/metrics";

interface Props {
  speciesId: string;
  onClose: () => void;
}

export default function SpeciesDetailDrawer({ speciesId, onClose }: Props) {
  const { currentState, history } = useSimStore();
  
  if (!currentState) return null;
  
  const species = currentState.species.find((s) => s.traits.id === speciesId);
  if (!species) return null;
  
  const traits = species.traits;
  const cooperationIndex = computeCooperationIndex(history);
  const coop = cooperationIndex[speciesId] ?? 0.7;
  
  const generateLore = () => {
    const parts = [];
    if (traits.lifespan > 100) parts.push("ancient");
    if (traits.discountFactor > 0.7) parts.push("patient");
    if (traits.expansionPreference > 0.7) parts.push("expansionist");
    if (traits.stabilityPreference > 0.7) parts.push("conservative");
    if (traits.normStrength > 0.7) parts.push("highly structured");
    
    let lore = `The ${species.traits.name} are ${parts.join(", ")} ${parts.length > 0 ? "species" : "beings"} with ${traits.mobility} mobility and ${traits.manipulation} technological capabilities.`;

    if (traits.linguisticRegime) {
      lore += ` They operate under a ${traits.linguisticRegime} linguistic regime.`;
    }
    if (traits.epistemicOrder) {
      lore += ` Their society is organized as a ${traits.epistemicOrder} epistemic order.`;
    }

    return lore;
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="bg-surface w-full sm:w-2/3 lg:w-1/2 max-h-[90vh] overflow-y-auto rounded-t-lg sm:rounded-lg border border-muted p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">{species.traits.name}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Lore</h3>
            <p className="text-gray-300">{generateLore()}</p>
          </div>
          
          {/* New Mechanics Section */}
          {(traits.linguisticRegime || traits.epistemicOrder) && (
            <div className="p-3 bg-muted/30 rounded-sm border border-muted border-dashed">
              <h3 className="text-sm font-bold text-accent mb-2 uppercase tracking-wide">Societal Constraints</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {traits.linguisticRegime && (
                  <div>
                    <span className="text-gray-400 block mb-1">Linguistic Regime</span>
                    <span className="text-white font-mono bg-background px-2 py-1 rounded-sm inline-block">
                      {traits.linguisticRegime}
                    </span>
                  </div>
                )}
                {traits.epistemicOrder && (
                  <div>
                    <span className="text-gray-400 block mb-1">Epistemic Order</span>
                    <span className="text-white font-mono bg-background px-2 py-1 rounded-sm inline-block">
                      {traits.epistemicOrder}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Traits</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-400">Lifespan:</span>{" "}
                <span className="text-white">{Math.round(traits.lifespan)} epochs</span>
              </div>
              <div>
                <span className="text-gray-400">Reproduction:</span>{" "}
                <span className="text-white">{traits.reproductionRate.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-400">Patience:</span>{" "}
                <span className="text-white">{traits.discountFactor.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-400">Perception Noise:</span>{" "}
                <span className="text-white">{traits.perceptionNoise.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-400">Mobility:</span>{" "}
                <span className="text-white">{traits.mobility}</span>
              </div>
              <div>
                <span className="text-gray-400">Technology:</span>{" "}
                <span className="text-white">{traits.manipulation}</span>
              </div>
              <div>
                <span className="text-gray-400">Norm Strength:</span>{" "}
                <span className="text-white">{traits.normStrength.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-400">Stability:</span>{" "}
                <span className="text-white">{traits.stabilityPreference.toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Current State</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-400">Population:</span>{" "}
                <span className="text-white">{(species.population / 1000000).toFixed(2)}M</span>
              </div>
              <div>
                <span className="text-gray-400">Tech Level:</span>{" "}
                <span className="text-white">{species.techLevel.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-400">Status:</span>{" "}
                <span className={species.alive ? "text-accent" : "text-warning"}>
                  {species.alive ? "Alive" : "Extinct"}
                </span>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Cooperation Index</h3>
            <div className="w-full bg-muted rounded-full h-4">
              <div
                className="bg-accent h-4 rounded-full"
                style={{ width: `${coop * 100}%` }}
              />
            </div>
            <span className="text-sm text-gray-400 mt-1">
              {coop.toFixed(2)} (1.0 = fully cooperative)
            </span>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Configured policy</h3>
            <p className="font-mono text-sm break-all">{species.policyBrainId}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
