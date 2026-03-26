import { Download, FileSpreadsheet, Info, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export default function Templates() {
  const downloadProductTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { 
        Nome: 'Produto Exemplo', 
        Código: 'REF-001', 
        Quantidade: 10, 
        Preço: '59,90', 
        Lucro: 30, 
        Categoria: 'Camisetas', 
        Marca: 'BagSync', 
        Tamanho: 'M', 
        Cor: 'Azul', 
        Descrição: 'Tecido 100% algodão' 
      }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produtos");
    XLSX.writeFile(wb, "modelo_importacao_produtos_bagsync.xlsx");
    toast.success('Modelo de produtos baixado!');
  };

  const downloadClientTemplate = () => {
    const columns = ['Nome*', 'Telefone*', 'CPF', 'Email', 'Endereço', 'Observações'];
    const example = ['Maria Silva', '(11) 99999-9999', '000.000.000-00', 'maria@email.com', 'Rua das Flores, 123 - SP', 'Cliente preferencial'];
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([columns, example]);
    
    // Column widths
    ws['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 16 }, { wch: 28 }, { wch: 35 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');

    // Instructions sheet
    const wsInfo = XLSX.utils.aoa_to_sheet([
      ['Instruções de preenchimento'],
      [''],
      ['* Nome e Telefone são obrigatórios.'],
      ['* CPF, Email, Endereço e Observações são opcionais.'],
      ['* Não altere o cabeçalho da primeira linha.'],
      ['* Você pode adicionar quantas linhas quiser.'],
    ]);
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Instruções');

    XLSX.writeFile(wb, 'modelo_importacao_clientes_bagsync.xlsx');
    toast.success('Modelo de clientes baixado!');
  };

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Modelos de Importação</h1>
        <p className="text-muted-foreground font-medium">Baixe as planilhas modelo para importar dados em massa para o sistema.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="overflow-hidden border-none shadow-md bg-gradient-to-br from-primary/5 to-background">
          <CardHeader>
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
              <FileSpreadsheet className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Produtos (Estoque)</CardTitle>
            <CardDescription>Modelo para cadastro massivo de produtos no inventário.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-xs space-y-2 text-muted-foreground">
              <div className="flex items-start gap-2">
                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                <p>Campos suportados: Nome, Código, Quantidade, Preço, Lucro, Categoria, Marca, Tamanho, Cor e Descrição.</p>
              </div>
            </div>
            <Button onClick={downloadProductTemplate} className="w-full gap-2">
              <Download className="h-4 w-4" /> Baixar Modelo .xlsx
            </Button>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-none shadow-md bg-gradient-to-br from-accent/5 to-background">
          <CardHeader>
            <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center mb-2">
              <Users className="h-6 w-6 text-accent" />
            </div>
            <CardTitle>Clientes</CardTitle>
            <CardDescription>Modelo para importar sua lista de contatos e clientes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-xs space-y-2 text-muted-foreground">
              <div className="flex items-start gap-2">
                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                <p>Campos obrigatórios: Nome e Telefone. Campos opcionais: CPF, Email, Endereço e Observações.</p>
              </div>
            </div>
            <Button onClick={downloadClientTemplate} variant="secondary" className="w-full gap-2">
              <Download className="h-4 w-4" /> Baixar Modelo .xlsx
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-dashed bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4" /> Dicas de Preenchimento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-4">
            <li>Mantenha sempre a primeira linha (cabeçalhos) exatamente como no modelo.</li>
            <li>Para campos de valores (Preço), você pode usar vírgula ou ponto para decimais.</li>
            <li>Certifique-se de que os dados estão na primeira aba (planilha) do arquivo.</li>
            <li>Após preencher, utilize os botões "Importar" nas páginas de Produtos ou Clientes.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
