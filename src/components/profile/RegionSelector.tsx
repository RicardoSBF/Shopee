import React, { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";

interface RegionSelectorProps {
  primaryRegion?: string;
  backupRegions?: string[];
  onPrimaryRegionChange?: (region: string) => void;
  onBackupRegionsChange?: (regions: string[]) => void;
  disabled?: boolean;
}

const RegionSelector = ({
  primaryRegion = "",
  backupRegions = [],
  onPrimaryRegionChange = () => {},
  onBackupRegionsChange = () => {},
  disabled = false,
}: RegionSelectorProps) => {
  // Lista de regiões disponíveis
  const regions = [
    "ARARICA",
    "BOM PRINCIPIO",
    "CAMPO BOM",
    "CAPELA DE SANTANA",
    "DOIS IRMAOS",
    "ESTANCIA VELHA",
    "ESTEIO",
    "HARMONIA",
    "IGREJINHA",
    "IVOTI",
    "LINDOLFO COLLOR",
    "MONTENEGRO",
    "MORRO REUTER",
    "NOVA HARTZ",
    "NOVO HAMBURGO",
    "PARECI NOVO",
    "PAROBE",
    "PICADA CAFE",
    "PORTAO",
    "PRESIDENTE LUCENA",
    "RIOZINHO",
    "ROLANTE",
    "SANTA MARIA DO HERVAL",
    "SAO JOSE DO HORTENCIO",
    "SAO LEOPOLDO",
    "SAO SEBASTIAO DO CAI",
    "SAPIRANGA",
    "SAPUCAIA DO SUL",
    "TAQUARA",
    "TRES COROAS",
  ];

  const [selectedPrimary, setSelectedPrimary] = useState<string>(primaryRegion);
  const [selectedBackups, setSelectedBackups] =
    useState<string[]>(backupRegions);

  const handlePrimarySelect = (value: string) => {
    setSelectedPrimary(value);
    onPrimaryRegionChange(value);

    // Remove from backup regions if it was there
    if (selectedBackups.includes(value)) {
      const updatedBackups = selectedBackups.filter(
        (region) => region !== value,
      );
      setSelectedBackups(updatedBackups);
      onBackupRegionsChange(updatedBackups);
    }
  };

  const handleBackupToggle = (region: string) => {
    // Don't allow selecting primary region as backup
    if (region === selectedPrimary) return;

    let updatedBackups: string[];

    if (selectedBackups.includes(region)) {
      // Remove region if already selected
      updatedBackups = selectedBackups.filter((r) => r !== region);
    } else {
      // Add region if not already selected and we have less than 3 backups
      if (selectedBackups.length < 3) {
        updatedBackups = [...selectedBackups, region];
      } else {
        // Already have 3 backups, don't add more
        return;
      }
    }

    setSelectedBackups(updatedBackups);
    onBackupRegionsChange(updatedBackups);
  };

  const isBackupSelected = (region: string) => {
    return selectedBackups.includes(region);
  };

  return (
    <Card className="w-full max-w-[550px] bg-white">
      <CardHeader>
        <CardTitle>Seleção de Região</CardTitle>
        <CardDescription>
          Selecione sua região principal e até 3 regiões de backup para
          atribuições de entrega.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div>
          <h3 className="text-sm font-medium mb-2">Região Principal</h3>
          <Select
            value={selectedPrimary}
            onValueChange={handlePrimarySelect}
            disabled={disabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione sua região principal" />
            </SelectTrigger>
            <SelectContent>
              {regions.map((region) => (
                <SelectItem key={region} value={region}>
                  {region}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPrimary && (
            <div className="mt-2">
              <Badge
                variant="default"
                className="bg-primary text-primary-foreground"
              >
                {selectedPrimary}
              </Badge>
            </div>
          )}
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium">
              Regiões de Backup (Selecione até 3)
            </h3>
            <Badge variant="secondary">{selectedBackups.length}/3</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {regions.map((region) => (
              <Button
                key={region}
                variant={isBackupSelected(region) ? "default" : "outline"}
                className={`justify-start h-auto py-2 ${region === selectedPrimary ? "opacity-50 cursor-not-allowed" : ""}`}
                onClick={() => handleBackupToggle(region)}
                disabled={region === selectedPrimary || disabled}
              >
                <div className="flex items-center w-full">
                  <span className="flex-1 text-left">{region}</span>
                  {isBackupSelected(region) ? (
                    <Check className="h-4 w-4 ml-2" />
                  ) : region !== selectedPrimary ? (
                    <X className="h-4 w-4 ml-2 opacity-50" />
                  ) : null}
                </div>
              </Button>
            ))}
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex-col items-start">
        <h3 className="text-sm font-medium mb-2">Regiões Selecionadas</h3>
        <div className="flex flex-wrap gap-2">
          {selectedPrimary && (
            <Badge
              variant="default"
              className="bg-primary text-primary-foreground"
            >
              Principal: {selectedPrimary}
            </Badge>
          )}
          {selectedBackups.map((region) => (
            <Badge key={region} variant="secondary">
              Backup: {region}
            </Badge>
          ))}
        </div>
      </CardFooter>
    </Card>
  );
};

export default RegionSelector;
