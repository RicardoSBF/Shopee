import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Download,
  FileSpreadsheet,
  Calendar,
  Filter,
  Settings,
  AlertTriangle,
} from "lucide-react";
import ExportTable from "./ExportTable";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

interface ExportOptionsProps {
  onExport?: (options: ExportConfig) => void;
  isOpen?: boolean;
}

interface ExportConfig {
  format: string;
  shiftFilter: "AM" | "PM" | "OUROBOROS" | "ALL";
  dateRange: {
    from: string;
    to: string;
  };
  selectedRegions: string[];
}

const ExportOptions: React.FC<ExportOptionsProps> = ({
  onExport = () => {},
  isOpen = true,
}) => {
  const { toast } = useToast();

  // Função para adicionar notificação ao sistema
  const addNotification = (title: string, message: string) => {
    const newNotification = {
      id: Date.now().toString(),
      title,
      message,
      time: new Date().toISOString(),
      read: false,
    };

    try {
      // Obter notificações existentes
      const savedNotifications = localStorage.getItem("adminNotifications");
      let existingNotifications = [];

      if (savedNotifications) {
        try {
          const parsed = JSON.parse(savedNotifications);
          if (Array.isArray(parsed)) {
            existingNotifications = parsed;
          }
        } catch (parseError) {
          // Se não conseguir analisar, usar array vazio
        }
      }

      // Adicionar nova notificação no início e limitar a 20
      const updatedNotifications = [
        newNotification,
        ...existingNotifications.slice(0, 19),
      ];

      // Salvar no localStorage
      localStorage.setItem(
        "adminNotifications",
        JSON.stringify(updatedNotifications),
      );

      // Disparar evento para atualizar outras abas/janelas
      try {
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "adminNotifications",
            newValue: JSON.stringify(updatedNotifications),
          }),
        );

        // Também disparar um evento customizado
        window.dispatchEvent(new CustomEvent("notification-added"));
      } catch (eventError) {
        // Ignorar erros de evento
      }
    } catch (error) {
      // Ignorar erros de armazenamento
    }
  };

  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    format: "excel",
    shiftFilter: "ALL",
    dateRange: {
      from: format(new Date(), "yyyy-MM-dd"),
      to: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
    },
    selectedRegions: ["Todas as Regiões"],
  });

  const [driverData, setDriverData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [isExportDisabled, setIsExportDisabled] = useState(false);

  // Carregar dados dos motoristas do Supabase
  useEffect(() => {
    const fetchDriverData = async () => {
      try {
        // Buscar todos os usuários com suas regiões, verificações e disponibilidades
        const { data: users, error: usersError } = await supabase
          .from("users")
          .select(
            `
            id,
            phone_number,
            email,
            full_name,
            regions(primary_region, backup_regions),
            driver_verification(delivery_fee, is_verified),
            availability(shift, date)
          `,
          )
          .eq("is_admin", false);

        if (usersError) {
          console.error("Erro ao buscar usuários:", usersError);
          return;
        }

        // Processar dados dos usuários para o formato da planilha
        const processedData = [];

        if (users && users.length > 0) {
          // Extrair e processar dados dos motoristas
          for (const user of users) {
            // Verificar taxa de entrega
            const deliveryRate =
              user.driver_verification?.[0]?.delivery_fee || 0;
            const primaryRegion = user.regions?.[0]?.primary_region || "";
            const shift = user.availability?.[0]?.shift || "NONE";
            const fullName = user.full_name || "";

            // Usar apenas dados reais, sem probabilidades ou dados fictícios
            processedData.push({
              gaiola: "X", // Substituir gaiola por "X"
              cidade: primaryRegion ? primaryRegion : "Não definida",
              driver: fullName, // Usar nome real do motorista
              taxaEntrega: deliveryRate,
              shift: shift,
            });
          }
        }

        setDriverData(processedData);
        setFilteredData(processedData);
      } catch (error) {
        console.error("Erro ao buscar dados dos motoristas:", error);
      }
    };

    fetchDriverData();
  }, []);

  // Filtrar dados com base na configuração de exportação - otimizado
  useEffect(() => {
    // Usar uma função debounced para evitar múltiplas renderizações
    const debouncedFilter = setTimeout(() => {
      let filtered = [...driverData];

      // Aplicar filtro de turno
      if (exportConfig.shiftFilter !== "ALL") {
        filtered = filtered.filter(
          (row) => row.shift === exportConfig.shiftFilter,
        );
      }

      // Aplicar filtro de região
      if (exportConfig.selectedRegions[0] !== "Todas as Regiões") {
        filtered = filtered.filter((row) =>
          row.cidade.includes(exportConfig.selectedRegions[0]),
        );
      }

      setFilteredData(filtered);
      setIsExportDisabled(exportConfig.shiftFilter === "ALL");
    }, 100); // Pequeno delay para melhorar performance

    return () => clearTimeout(debouncedFilter);
  }, [exportConfig, driverData]);

  const handleExport = () => {
    if (exportConfig.shiftFilter === "ALL") {
      alert(
        "Por favor, selecione um turno específico (AM, PM ou OUROBOROS) para exportar.",
      );
      return;
    }

    onExport(exportConfig);

    // Criar um arquivo Excel para download (simulado como CSV)
    let csvContent = "data:text/csv;charset=UTF-8,\uFEFF"; // BOM para suporte a caracteres especiais

    // Cabeçalhos
    let headers = [
      "Gaiola",
      "Cidade",
      "Driver planejado",
      "Taxa de Entrega",
      "Turno",
    ];

    csvContent += headers.join(";") + "\r\n"; // Usar ponto e vírgula como separador para melhor compatibilidade com Excel BR

    // Adicionar dados ao CSV
    filteredData.forEach((row) => {
      const rowData = [
        `"${row.gaiola.replace(/"/g, '""')}"`,
        `"${row.cidade.replace(/"/g, '""')}"`,
        `"${row.driver.replace(/"/g, '""')}"`,
        row.taxaEntrega ? `"${row.taxaEntrega.toFixed(2)}%"` : `"N/A"`,
        `"${row.shift}"`,
      ];
      csvContent += rowData.join(";") + "\r\n";
    });

    // Criar link para download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `motoristas_${exportConfig.shiftFilter}_${format(new Date(), "dd-MM-yyyy", { locale: ptBR })}.csv`,
    );
    document.body.appendChild(link);

    // Simular clique para iniciar download
    link.click();

    // Remover o link
    document.body.removeChild(link);

    // Adicionar notificação para exportação
    const formattedDate = format(new Date(), "dd/MM/yyyy", { locale: ptBR });
    const shiftText =
      exportConfig.shiftFilter === "AM"
        ? "turno AM"
        : exportConfig.shiftFilter === "PM"
          ? "turno PM"
          : "turno OUROBOROS";

    addNotification(
      "Exportação concluída",
      `Dados de motoristas exportados com sucesso para ${exportConfig.format.toUpperCase()} (${formattedDate}, ${shiftText}).`,
    );

    // Mostrar toast de sucesso
    toast({
      title: "Exportação concluída",
      description: `Os dados foram exportados com sucesso no formato ${exportConfig.format.toUpperCase()}.`,
      variant: "default",
    });

    alert(
      `Exportação de motoristas do turno ${exportConfig.shiftFilter} concluída! O arquivo foi baixado.`,
    );
  };

  const regions = [
    "Todas as Regiões",
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

  return (
    <div className="bg-white p-4 rounded-lg shadow-md border border-orange-100 w-full">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Exportar Dados de Motoristas
          </CardTitle>
          <CardDescription>
            Configure opções de exportação e baixe dados de motoristas para
            planejamento de rotas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Preview da tabela de exportação */}
          <div className="mb-4">
            <Label className="mb-2 block font-bold text-orange-700">
              Prévia da Exportação
            </Label>
            <ExportTable data={filteredData.slice(0, 10)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="format">Formato de Exportação</Label>
            <Select
              value={exportConfig.format}
              onValueChange={(value) =>
                setExportConfig({ ...exportConfig, format: value })
              }
            >
              <SelectTrigger id="format">
                <SelectValue placeholder="Selecionar formato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excel">Excel (.xlsx)</SelectItem>
                <SelectItem value="csv">CSV (.csv)</SelectItem>
                <SelectItem value="pdf">PDF (.pdf)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Intervalo de Datas</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <Label
                  htmlFor="date-from"
                  className="text-xs text-muted-foreground"
                >
                  De
                </Label>
                <Input
                  id="date-from"
                  type="date"
                  value={exportConfig.dateRange.from}
                  onChange={(e) =>
                    setExportConfig({
                      ...exportConfig,
                      dateRange: {
                        ...exportConfig.dateRange,
                        from: e.target.value,
                      },
                    })
                  }
                />
              </div>
              <div className="flex-1">
                <Label
                  htmlFor="date-to"
                  className="text-xs text-muted-foreground"
                >
                  Até
                </Label>
                <Input
                  id="date-to"
                  type="date"
                  value={exportConfig.dateRange.to}
                  onChange={(e) =>
                    setExportConfig({
                      ...exportConfig,
                      dateRange: {
                        ...exportConfig.dateRange,
                        to: e.target.value,
                      },
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Filtrar por Região</Label>
            <Select
              value={exportConfig.selectedRegions[0]}
              onValueChange={(value) =>
                setExportConfig({ ...exportConfig, selectedRegions: [value] })
              }
            >
              <SelectTrigger id="region">
                <SelectValue placeholder="Selecionar região" />
              </SelectTrigger>
              <SelectContent>
                {regions.map((region) => (
                  <SelectItem key={region} value={region}>
                    {region}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <Label>Filtrar por Turno</Label>
              {isExportDisabled && (
                <Badge
                  variant="outline"
                  className="text-amber-500 border-amber-500 flex items-center gap-1"
                >
                  <AlertTriangle className="h-3 w-3" />
                  Selecione um turno
                </Badge>
              )}
            </div>
            <RadioGroup
              value={exportConfig.shiftFilter}
              onValueChange={(value: "AM" | "PM" | "OUROBOROS" | "ALL") =>
                setExportConfig({ ...exportConfig, shiftFilter: value })
              }
              className="flex flex-col space-y-1"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="AM" id="shift-am" />
                <Label htmlFor="shift-am" className="font-medium">
                  AM (3:30 - 7:30)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="PM" id="shift-pm" />
                <Label htmlFor="shift-pm" className="font-medium">
                  PM (11:00 - 13:30)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="OUROBOROS" id="shift-ouroboros" />
                <Label htmlFor="shift-ouroboros" className="font-medium">
                  OUROBOROS (15:00 - 17:30)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ALL" id="shift-all" />
                <Label
                  htmlFor="shift-all"
                  className="font-medium text-gray-400"
                >
                  Todos os turnos (apenas visualização)
                </Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button
            onClick={handleExport}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white transition-all duration-200 hover:shadow-md"
            disabled={isExportDisabled}
          >
            <Download className="h-4 w-4" />
            Exportar Dados
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default ExportOptions;
