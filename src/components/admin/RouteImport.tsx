import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { v4 as uuidv4 } from "uuid";
import { useForm } from "react-hook-form";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileUp,
  FileSpreadsheet,
  Loader2,
  AlertTriangle,
  Check,
  Calendar,
  Clock,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface IForm {
  file: FileList;
}

// Função para converter Excel para JSON conforme solicitado
const convertExcelToJson = (buffer: ArrayBuffer) => {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  return XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: null,
    raw: false,
  }) as string[][];
};

const RouteImport = () => {
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

    // Obter notificações existentes
    const savedNotifications = localStorage.getItem("adminNotifications");
    const existingNotifications = savedNotifications
      ? JSON.parse(savedNotifications)
      : [];

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
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "adminNotifications",
        newValue: JSON.stringify(updatedNotifications),
      }),
    );
  };

  // Função para disparar evento de atualização de rota
  const dispatchRouteUpdateEvent = () => {
    try {
      console.log("Disparando evento de atualização de rota");
      // Usar um evento personalizado para notificar outros componentes
      window.dispatchEvent(new CustomEvent("routes-updated"));

      // Forçar atualização do localStorage também
      const savedRoutes = localStorage.getItem("importedRoutes");
      if (savedRoutes) {
        // Apenas para forçar um evento de armazenamento
        localStorage.setItem("importedRoutes", savedRoutes);
      }

      // Disparar evento de armazenamento para compatibilidade
      try {
        // Criar um novo evento de armazenamento manualmente
        const storageEvent = new StorageEvent("storage");
        // Definir propriedades manualmente
        Object.defineProperty(storageEvent, "key", { value: "importedRoutes" });
        Object.defineProperty(storageEvent, "newValue", { value: savedRoutes });

        window.dispatchEvent(storageEvent);
        console.log("Evento de armazenamento disparado");
      } catch (storageError) {
        console.error(
          "Erro ao disparar evento de armazenamento:",
          storageError,
        );
        // Ignorar erros de evento de armazenamento
      }
    } catch (error) {
      console.error("Erro ao disparar evento de atualização:", error);
      // Falhar silenciosamente se não for possível disparar o evento
    }
  };

  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedShift, setSelectedShift] = useState<"AM" | "PM" | "OUROBOROS">(
    "AM",
  );
  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [excelData, setExcelData] = useState<string[][]>([]);

  // Usando react-hook-form para gerenciar o arquivo
  const { register, watch, reset } = useForm<IForm>();
  const file = watch("file");

  // Processar o arquivo quando selecionado
  useEffect(() => {
    if (file && file.length > 0) {
      // Verificar se todos os arquivos são Excel
      for (let i = 0; i < file.length; i++) {
        const fileName = file[i].name.toLowerCase();
        if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
          setError(
            `O arquivo "${file[i].name}" não é um arquivo Excel válido. Por favor, selecione apenas arquivos Excel (.xlsx, .xls)`,
          );
          return;
        }
      }

      // Processar o primeiro arquivo (para visualização)
      file[0].arrayBuffer().then((buffer) => {
        try {
          const data = convertExcelToJson(buffer);
          setExcelData(data);
          setError(null);
        } catch (err) {
          console.error("Erro ao processar arquivo Excel:", err);
          setError(
            `Erro ao processar o arquivo "${file[0].name}". Verifique se o formato é válido.`,
          );
        }
      });
    }
  }, [file]);

  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return "";
      const date = parseISO(dateString);
      return format(date, "dd/MM/yyyy", { locale: ptBR });
    } catch (error) {
      console.error("Erro ao formatar data:", error, dateString);
      return dateString || "";
    }
  };

  const handleImport = async () => {
    if (!file || file.length === 0) {
      setError("Por favor, selecione pelo menos um arquivo");
      return;
    }

    if (excelData.length === 0) {
      setError("Não foi possível processar os dados do arquivo");
      return;
    }

    // Verificar novamente se todos os arquivos são Excel
    for (let i = 0; i < file.length; i++) {
      const fileName = file[i].name.toLowerCase();
      if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
        setError(
          `O arquivo "${file[i].name}" não é um arquivo Excel válido. Por favor, selecione apenas arquivos Excel (.xlsx, .xls)`,
        );
        return;
      }
    }

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Processar cada arquivo selecionado
      const importPromises = [];

      for (let fileIndex = 0; fileIndex < file.length; fileIndex++) {
        const currentFile = file[fileIndex];

        // Criar uma promessa para processar cada arquivo
        const processFilePromise = new Promise(async (resolve, reject) => {
          try {
            const buffer = await currentFile.arrayBuffer();
            const fileData = convertExcelToJson(buffer);
            const dataRows = fileData.slice(1); // Pular a primeira linha se for um cabeçalho

            console.log(
              `Iniciando processamento da rota ${fileIndex + 1}/${file.length} para Supabase`,
            );

            // Extrair informações específicas dos índices solicitados
            const routeData = {
              file_name: currentFile.name,
              city: "",
              neighborhoods: new Set<string>(),
              total_distance: 0,
              sequence: 0,
              route_name: "",
              shift: selectedShift,
              date: selectedDate,
              created_at: new Date().toISOString(),
            };

            console.log(
              `Processando dados do Excel ${currentFile.name}:`,
              dataRows,
            );

            // Obter a distância do primeiro registro apenas (índice 3)
            if (dataRows.length > 0 && dataRows[0] && dataRows[0].length > 3) {
              const distanceStr = dataRows[0][3] || "0";
              const distance = parseFloat(
                distanceStr
                  .toString()
                  .replace(/[^\d.,]/g, "")
                  .replace(",", "."),
              );
              if (!isNaN(distance)) {
                routeData.total_distance = distance;
              }
            }

            // Processar cada linha para extrair os dados necessários
            dataRows.forEach((row) => {
              if (row && row.length > 15) {
                // Quantidade de pacotes (índice 0)
                const packages = parseInt(row[0] || "0");
                if (!isNaN(packages) && packages > routeData.sequence) {
                  routeData.sequence = packages;
                }

                // Endereço completo (índice 6)
                if (row[6]) {
                  // Extrair cidade e bairro do endereço completo
                  const addressParts = String(row[6]).split(",");
                  if (addressParts.length >= 2) {
                    // O último elemento geralmente contém a cidade
                    const cityPart =
                      addressParts[addressParts.length - 1].trim();
                    if (cityPart && !routeData.city) {
                      routeData.city = cityPart;
                    }

                    // O penúltimo elemento geralmente contém o bairro
                    if (addressParts.length >= 3) {
                      const neighborhood =
                        addressParts[addressParts.length - 2].trim();
                      if (neighborhood) {
                        routeData.neighborhoods.add(neighborhood);
                      }
                    }
                  }
                }

                // Cidade (índice 7) - backup se não conseguir extrair do endereço
                if (row[7] && !routeData.city) {
                  routeData.city = row[7];
                }

                // Bairros (índice 8) - backup se não conseguir extrair do endereço
                if (row[8]) {
                  routeData.neighborhoods.add(row[8]);
                }

                // Nome da rota (índice 15)
                if (row[15] && !routeData.route_name) {
                  routeData.route_name = row[15];
                }
              }
            });

            console.log(`Dados extraídos do Excel ${currentFile.name}:`, {
              sequence: routeData.sequence,
              total_distance: routeData.total_distance,
              city: routeData.city,
              neighborhoods: Array.from(routeData.neighborhoods),
              route_name: routeData.route_name,
            });

            // Gerar um ID único para a rota
            const routeId = uuidv4();

            // Finalizar o processamento dos dados
            const finalRouteData = {
              id: routeId,
              file_name: routeData.route_name || currentFile.name,
              city: routeData.city || "Cidade não especificada",
              neighborhoods: Array.from(routeData.neighborhoods),
              total_distance: routeData.total_distance || 0,
              sequence: routeData.sequence || dataRows.length,
              shift: selectedShift,
              date: selectedDate,
              created_at: new Date().toISOString(),
              // Armazenar apenas os primeiros 20 registros para evitar problemas de tamanho
              raw_data: fileData.slice(0, 20),
            };

            console.log(`ID da rota gerado para ${currentFile.name}:`, routeId);
            console.log(
              `Dados finais para importação de ${currentFile.name}:`,
              finalRouteData,
            );

            // Verificar se uma rota com o mesmo nome, turno e data já existe
            try {
              // Primeiro verificar se uma rota similar já existe
              const { data: existingRoutes, error: checkError } = await supabase
                .from("routes")
                .select("id, file_name, shift, date")
                .eq("file_name", finalRouteData.file_name)
                .eq("shift", finalRouteData.shift)
                .eq("date", finalRouteData.date);

              if (checkError) {
                console.error(
                  `Erro ao verificar rotas existentes para ${currentFile.name}:`,
                  checkError,
                );
                // Continuar mesmo com erro de verificação
                console.log(
                  `Continuando mesmo com erro de verificação para ${currentFile.name}`,
                );
              }

              // Se uma rota similar já existe, mostrar aviso na tela e pular este arquivo
              if (existingRoutes && existingRoutes.length > 0) {
                // Mostrar toast de aviso para o usuário
                toast({
                  title: "Rota duplicada",
                  description: `Uma rota com o nome ${finalRouteData.file_name} para o turno ${finalRouteData.shift} na data ${formatDate(finalRouteData.date)} já existe.`,
                  variant: "warning",
                });

                // Adicionar notificação ao sistema
                addNotification(
                  "Rota duplicada",
                  `A rota ${finalRouteData.file_name} para o turno ${finalRouteData.shift} na data ${formatDate(finalRouteData.date)} já existe e não foi importada novamente.`,
                );

                resolve({
                  success: false,
                  fileName: currentFile.name,
                  error: "Rota duplicada",
                  message: `Uma rota com o nome ${finalRouteData.file_name} para o turno ${finalRouteData.shift} na data ${formatDate(finalRouteData.date)} já existe.`,
                });
                return;
              }

              // Preparar dados para inserção no Supabase
              const supabaseRouteData = {
                id: finalRouteData.id,
                file_name: finalRouteData.file_name,
                city: finalRouteData.city,
                neighborhoods: finalRouteData.neighborhoods,
                total_distance: finalRouteData.total_distance,
                sequence: finalRouteData.sequence,
                shift: finalRouteData.shift,
                date: finalRouteData.date,
                created_at: finalRouteData.created_at,
                raw_data: finalRouteData.raw_data, // Incluir raw_data com tamanho limitado
              };

              // Salvar no Supabase com abordagem simplificada
              console.log(
                `Salvando no Supabase (dados simplificados) para ${currentFile.name}:`,
                supabaseRouteData,
              );

              // Removido teste de conexão desnecessário

              const { data, error } = await supabase
                .from("routes")
                .insert([supabaseRouteData])
                .select();

              console.log(`Resposta do Supabase para ${currentFile.name}:`, {
                data,
                error,
              });

              // Se houver erro no Supabase
              if (error) {
                console.error(
                  `Erro ao salvar no Supabase para ${currentFile.name}:`,
                  error,
                );
                console.error(
                  "Detalhes do erro:",
                  error.details,
                  error.hint,
                  error.message,
                );

                // Mostrar notificação de erro
                toast({
                  title: "Erro ao salvar rota",
                  description: `Não foi possível salvar a rota ${finalRouteData.file_name} no banco de dados. Erro: ${error.message}`,
                  variant: "destructive",
                });

                // Adicionar notificação ao sistema
                addNotification(
                  "Erro ao importar rota",
                  `Ocorreu um erro ao importar a rota ${finalRouteData.file_name}. Erro: ${error.message}`,
                );

                resolve({
                  success: false,
                  fileName: currentFile.name,
                  error: error.message,
                });
              } else {
                // Sucesso ao salvar no Supabase
                if (data && data.length > 0) {
                  const route = data[0];

                  // Adicionar notificação para rota importada com sucesso
                  addNotification(
                    "Rota importada",
                    `A rota ${route.city} (${route.file_name}) foi importada com sucesso para o turno ${route.shift} em ${format(new Date(route.date), "dd/MM/yyyy", { locale: ptBR })}.`,
                  );

                  // Disparar evento para atualizar outras partes da aplicação
                  dispatchRouteUpdateEvent();
                }

                resolve({
                  success: true,
                  fileName: currentFile.name,
                  local: false,
                });
              }
            } catch (dbError) {
              console.error(
                `Erro ao salvar no banco de dados para ${currentFile.name}:`,
                dbError,
              );

              // Mostrar notificação de erro
              toast({
                title: "Erro ao salvar rota",
                description: `Não foi possível salvar a rota ${finalRouteData.file_name} no banco de dados. Erro: ${dbError.message}`,
                variant: "destructive",
              });

              // Adicionar notificação ao sistema
              addNotification(
                "Erro ao importar rota",
                `Ocorreu um erro ao importar a rota ${finalRouteData.file_name}. Erro: ${dbError.message}`,
              );

              resolve({
                success: false,
                fileName: currentFile.name,
                error: dbError.message,
              });
            }
          } catch (processError) {
            console.error(
              `Erro ao processar arquivo ${currentFile.name}:`,
              processError,
            );
            reject({
              success: false,
              fileName: currentFile.name,
              error: processError.message,
            });
          }
        });

        importPromises.push(processFilePromise);
      }

      // Aguardar todas as importações serem concluídas
      const results = await Promise.allSettled(importPromises);
      console.log("Resultados de todas as importações:", results);

      // Verificar resultados
      const successful = results.filter(
        (r) => r.status === "fulfilled" && r.value.success,
      ).length;
      const failed = results.filter(
        (r) =>
          r.status === "rejected" ||
          (r.status === "fulfilled" && !r.value.success),
      ).length;

      if (successful > 0) {
        setSuccess(true);

        // Mostrar notificação de sucesso com toast
        toast({
          title: `${successful} ${successful === 1 ? "rota importada" : "rotas importadas"} com sucesso`,
          description: `${successful} ${successful === 1 ? "rota foi importada" : "rotas foram importadas"} para o turno ${selectedShift} em ${format(new Date(selectedDate), "dd/MM/yyyy", { locale: ptBR })}.${failed > 0 ? ` ${failed} ${failed === 1 ? "arquivo falhou" : "arquivos falharam"}.` : ""}`,
          variant: "default",
        });

        // Fechar a janela imediatamente após importação bem-sucedida
        setIsOpen(false);
        reset(); // Limpar o formulário
        setExcelData([]);
        setSuccess(false);
        // Não aplicar filtros automaticamente após importação
      } else if (failed > 0) {
        // Se todas falharam, mostrar erro
        setError(
          `Falha ao importar ${failed} ${failed === 1 ? "arquivo" : "arquivos"}. Verifique os logs para mais detalhes.`,
        );

        // Mostrar notificação de erro
        toast({
          title: "Erro ao importar rotas",
          description: `Ocorreu um erro ao importar as rotas. Por favor, verifique os arquivos e tente novamente.`,
          variant: "destructive",
        });
      }

      // Notificações são tratadas acima para cada caso
    } catch (err) {
      console.error("Erro ao importar rotas:", err);
      setError("Erro ao importar rotas. Por favor, tente novamente.");

      // Mostrar notificação de erro
      toast({
        title: "Erro ao importar rota",
        description:
          "Ocorreu um erro ao importar a rota. Por favor, verifique o arquivo e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] rounded-full px-5 py-6">
          <FileUp className="h-5 w-5" />
          Importar Rotas
        </Button>
      </DialogTrigger>

      <DialogContent
        className="sm:max-w-[600px] bg-white dark:bg-gray-900 rounded-xl border-orange-200"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl text-orange-700">
            <FileSpreadsheet className="h-7 w-7 text-orange-500" />
            Importar Rotas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Turno</Label>
              <Select
                value={selectedShift}
                onValueChange={(value: "AM" | "PM" | "OUROBOROS") =>
                  setSelectedShift(value)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecionar turno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AM">AM (3:30 - 7:30)</SelectItem>
                  <SelectItem value="PM">PM (11:00 - 13:30)</SelectItem>
                  <SelectItem value="OUROBOROS">
                    OUROBOROS (15:00 - 17:30)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Data</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd")}
                className="w-full"
              />
            </div>
          </div>

          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-orange-200 dark:border-orange-700 rounded-xl bg-gradient-to-b from-orange-50 to-white dark:bg-gray-800/50 transition-all duration-300 hover:border-orange-500 dark:hover:border-orange-600 shadow-sm">
            <FileSpreadsheet className="h-16 w-16 text-orange-500 mb-4" />
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 text-center">
              Selecione um ou mais arquivos Excel (.xlsx, .xls) contendo os
              dados das rotas.
              <br />
              <span className="text-xs text-orange-600 dark:text-orange-400 block mt-2 font-medium">
                Extrairemos: Quantidade de Pacotes, Distância Total, Cidade,
                Bairros e Nome da Rota
              </span>
            </p>
            <Label
              htmlFor="file-upload"
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-3 px-5 rounded-full cursor-pointer transition-all duration-200 hover:shadow-md flex items-center gap-2 font-medium"
            >
              <FileUp className="h-5 w-5" />
              Selecionar Arquivos
            </Label>
            <Input
              id="file-upload"
              type="file"
              accept=".xlsx,.xls"
              multiple
              className="hidden"
              {...register("file")}
            />
          </div>

          {file && file.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  {file.length}{" "}
                  {file.length === 1
                    ? "arquivo selecionado"
                    : "arquivos selecionados"}
                </span>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-2">
                {Array.from(file).map((f, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-100 dark:border-orange-800/30 shadow-sm"
                  >
                    <FileSpreadsheet className="h-5 w-5 text-orange-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-orange-700 dark:text-orange-300 block truncate">
                        {f.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {(f.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {excelData.length > 0 && (
            <div className="p-4 bg-gradient-to-r from-green-50 to-green-50/50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800/30 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-green-100 p-2 rounded-full">
                  <Check className="h-5 w-5 text-green-600" />
                </div>
                <span className="text-sm font-medium text-green-700 dark:text-green-300">
                  Arquivo processado com sucesso!
                </span>
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 bg-white p-2 rounded-md border border-green-100">
                <p className="flex justify-between">
                  <span>Linhas encontradas:</span>
                  <span className="font-medium text-green-700">
                    {excelData.length}
                  </span>
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-red-50 to-red-50/50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800/30 shadow-sm">
              <div className="bg-red-100 p-2 rounded-full">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600" />
              </div>
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-green-50 to-green-50/50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg border border-green-200 dark:border-green-800/30 shadow-sm">
              <div className="bg-green-100 p-2 rounded-full">
                <Check className="h-5 w-5 flex-shrink-0 text-green-600" />
              </div>
              <div>
                <span className="text-sm font-medium block">
                  Rotas importadas com sucesso!
                </span>
                <span className="text-xs text-gray-600">
                  A rota já está disponível para visualização
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => {
              setIsOpen(false);
              reset();
              setExcelData([]);
              setError(null);
            }}
            disabled={isLoading}
            className="rounded-full border-gray-200 hover:bg-gray-50 transition-all duration-200"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={isLoading || !file || file.length === 0}
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white transition-all duration-300 rounded-full shadow-md"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <FileUp className="h-5 w-5 mr-2" />
                Importar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RouteImport;
