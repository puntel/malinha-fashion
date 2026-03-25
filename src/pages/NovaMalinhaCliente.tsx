import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserRound, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { ClienteRecord } from '@/components/ClientesTab';

export default function NovaMalinhaCliente() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // New fields
  const [sameAddress, setSameAddress] = useState(false);
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [collectionLocation, setCollectionLocation] = useState('');
  const [totalPieces, setTotalPieces] = useState('');
  const [sendDate, setSendDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnDate, setReturnDate] = useState('');

  // Autocomplete state
  const [clienteSearch, setClienteSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<ClienteRecord | null>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  const formatCpf = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  const formatPhone = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  // Fetch clientes for autocomplete (RLS handles visibility per role)
  const { data: clientes = [], isLoading: loadingClientes } = useQuery({
    queryKey: ['clientes-autocomplete', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, name, phone, cpf, email, address, notes, vendedora_id, loja_id, created_by, archived, created_at')
        .eq('archived', false)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data as ClienteRecord[]) || [];
    },
    enabled: !!user,
  });

  // Filter suggestions based on search
  const suggestions = clienteSearch.trim().length >= 2
    ? clientes.filter(c => {
        const q = clienteSearch.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.phone.replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
          (c.cpf || '').replace(/\D/g, '').includes(q.replace(/\D/g, ''))
        );
      }).slice(0, 8)
    : [];

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectCliente = (c: ClienteRecord) => {
    setSelectedCliente(c);
    setName(c.name);
    setCpf(c.cpf || '');
    setPhone(c.phone);
    setAddress(c.address || '');
    setDeliveryLocation(c.address || '');
    setCollectionLocation(c.address || '');
    setClienteSearch(c.name);
    setShowSuggestions(false);
  };

  const clearSelectedCliente = () => {
    setSelectedCliente(null);
    setClienteSearch('');
    setName('');
    setCpf('');
    setPhone('');
    setAddress('');
    setDeliveryLocation('');
    setCollectionLocation('');
    setTotalPieces('');
    setSendDate(new Date().toISOString().split('T')[0]);
    setReturnDate('');
  };

  const isValid =
    name.trim().length >= 2 &&
    phone.replace(/\D/g, '').length >= 10;

  const handleAdvance = () => {
    const params = new URLSearchParams({
      name,
      cpf,
      phone,
      address,
      deliveryLocation: sameAddress ? address : deliveryLocation,
      collectionLocation: sameAddress ? address : collectionLocation,
      totalPieces,
      sendDate,
      returnDate
    });
    navigate(`/nova-malinha/produtos?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Nova Malinha</p>
            <h1 className="font-display text-lg font-semibold">Dados da Cliente</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6 space-y-5">
        {/* ─── Autocomplete de Cliente Cadastrada ─── */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Buscar cliente cadastrada</p>
          </div>

          {selectedCliente ? (
            <div className="flex items-center justify-between rounded-lg bg-primary/10 border border-primary/20 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-primary truncate">{selectedCliente.name}</p>
                <p className="text-xs text-muted-foreground">{selectedCliente.phone}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground" onClick={clearSelectedCliente}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div ref={autocompleteRef} className="relative">
              <Input
                placeholder="Digite nome, telefone ou CPF..."
                value={clienteSearch}
                onChange={e => {
                  setClienteSearch(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
              />
              {loadingClientes && clienteSearch.length >= 2 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-xl border bg-card shadow-lg overflow-hidden">
                  {suggestions.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-accent transition-colors border-b last:border-0"
                      onMouseDown={() => selectCliente(c)}
                    >
                      <UserRound className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.phone}{c.cpf ? ` · CPF: ${c.cpf}` : ''}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showSuggestions && clienteSearch.trim().length >= 2 && suggestions.length === 0 && !loadingClientes && (
                <div className="absolute z-50 mt-1 w-full rounded-xl border bg-card shadow-lg px-3 py-2.5 text-sm text-muted-foreground">
                  Nenhuma cliente encontrada. Preencha os dados abaixo manualmente.
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Selecione uma cliente já cadastrada para preencher os dados automaticamente, ou preencha manualmente abaixo.
          </p>
        </div>

        {/* ─── Formulário manual ─── */}
        <div className="space-y-2">
          <Label htmlFor="name">Nome completo</Label>
          <Input
            id="name"
            placeholder="Maria Clara Santos"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cpf">CPF <span className="text-muted-foreground text-xs">(opcional)</span></Label>
          <Input
            id="cpf"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={e => setCpf(formatCpf(e.target.value))}
            inputMode="numeric"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Telefone (WhatsApp)</Label>
          <Input
            id="phone"
            placeholder="(11) 99999-9999"
            value={phone}
            onChange={e => setPhone(formatPhone(e.target.value))}
            inputMode="tel"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Endereço (opcional)</Label>
          <Input
            id="address"
            placeholder="Rua Exemplo, 123, Bairro"
            value={address}
            onChange={e => setAddress(e.target.value)}
          />
        </div>

        {/* ─── Logística ─── */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Logística</p>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="sameAddress"
              checked={sameAddress}
              onCheckedChange={(checked) => setSameAddress(checked as boolean)}
            />
            <Label htmlFor="sameAddress" className="text-sm">MESMO ENDEREÇO DE CADASTRO</Label>
          </div>

          {!sameAddress && (
            <>
              <div className="space-y-2">
                <Label htmlFor="deliveryLocation">Local de entrega</Label>
                <Input
                  id="deliveryLocation"
                  placeholder="Endereço de entrega"
                  value={deliveryLocation}
                  onChange={e => setDeliveryLocation(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="collectionLocation">Local de coleta</Label>
                <Input
                  id="collectionLocation"
                  placeholder="Endereço de coleta"
                  value={collectionLocation}
                  onChange={e => setCollectionLocation(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="totalPieces">Total de peças enviadas</Label>
            <Input
              id="totalPieces"
              type="number"
              placeholder="0"
              value={totalPieces}
              onChange={e => setTotalPieces(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sendDate">Data de envio da mala</Label>
            <Input
              id="sendDate"
              type="date"
              value={sendDate}
              onChange={e => setSendDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="returnDate">Data de retorno</Label>
            <Input
              id="returnDate"
              type="date"
              value={returnDate}
              onChange={e => setReturnDate(e.target.value)}
            />
          </div>
        </div>

        <Button onClick={handleAdvance} disabled={!isValid} className="w-full mt-4" size="lg">
          Avançar para Produtos
        </Button>
      </main>
    </div>
  );
}
