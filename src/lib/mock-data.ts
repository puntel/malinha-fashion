export type ProductStatus = 'pending' | 'accepted' | 'rejected' | 'edited';

export interface Product {
  id: string;
  code: string;
  size: string;
  quantity: number;
  photoUrl: string;
  status: ProductStatus;
  clientNote?: string;
}

export interface Malinha {
  id: string;
  clientName: string;
  clientCpf: string;
  clientPhone: string;
  createdAt: string;
  status: 'Enviada' | 'Aguardando Retorno' | 'Finalizada';
  products: Product[];
  sellerName: string;
}

export type MalinhaStore = {
  malinhas: Malinha[];
  currentSeller: string;
};

const STORAGE_KEY = 'minha-malinha-data';

const initialData: MalinhaStore = {
  currentSeller: 'Ana Beatriz',
  malinhas: [
    {
      id: '1',
      clientName: 'Maria Clara Santos',
      clientCpf: '123.456.789-00',
      clientPhone: '(11) 99876-5432',
      createdAt: '2026-02-20',
      status: 'Enviada',
      sellerName: 'Ana Beatriz',
      products: [
        { id: 'p1', code: 'VT-001', size: 'M', quantity: 1, photoUrl: '/placeholder.svg', status: 'pending' },
        { id: 'p2', code: 'BL-042', size: 'P', quantity: 1, photoUrl: '/placeholder.svg', status: 'pending' },
        { id: 'p3', code: 'SK-018', size: 'G', quantity: 1, photoUrl: '/placeholder.svg', status: 'pending' },
      ],
    },
    {
      id: '2',
      clientName: 'Juliana Ferreira',
      clientCpf: '987.654.321-00',
      clientPhone: '(21) 98765-1234',
      createdAt: '2026-02-18',
      status: 'Aguardando Retorno',
      sellerName: 'Ana Beatriz',
      products: [
        { id: 'p4', code: 'DR-055', size: 'M', quantity: 1, photoUrl: '/placeholder.svg', status: 'pending' },
        { id: 'p5', code: 'JK-012', size: 'P', quantity: 1, photoUrl: '/placeholder.svg', status: 'pending' },
      ],
    },
    {
      id: '3',
      clientName: 'Camila Oliveira',
      clientCpf: '456.789.123-00',
      clientPhone: '(31) 97654-3210',
      createdAt: '2026-02-15',
      status: 'Finalizada',
      sellerName: 'Ana Beatriz',
      products: [
        { id: 'p6', code: 'TP-033', size: 'G', quantity: 1, photoUrl: '/placeholder.svg', status: 'accepted' },
        { id: 'p7', code: 'PT-021', size: 'M', quantity: 1, photoUrl: '/placeholder.svg', status: 'rejected' },
      ],
    },
  ],
};

export function getData(): MalinhaStore {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch { /* fall through */ }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
  return initialData;
}

export function saveData(data: MalinhaStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function addMalinha(malinha: Malinha) {
  const data = getData();
  data.malinhas.unshift(malinha);
  saveData(data);
}

export function getMalinhaById(id: string): Malinha | undefined {
  return getData().malinhas.find(m => m.id === id);
}

export function updateMalinha(id: string, updates: Partial<Malinha>) {
  const data = getData();
  const idx = data.malinhas.findIndex(m => m.id === id);
  if (idx >= 0) {
    data.malinhas[idx] = { ...data.malinhas[idx], ...updates };
    saveData(data);
  }
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}
