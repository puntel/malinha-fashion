export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      loja_members: {
        Row: {
          created_at: string
          id: string
          loja_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          loja_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          loja_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loja_members_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          address: string | null
          archived: boolean
          cpf: string | null
          created_at: string
          created_by: string
          email: string | null
          id: string
          loja_id: string | null
          name: string
          notes: string | null
          phone: string
          updated_at: string
          vendedora_id: string | null
        }
        Insert: {
          address?: string | null
          archived?: boolean
          cpf?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          id?: string
          loja_id?: string | null
          name: string
          notes?: string | null
          phone: string
          updated_at?: string
          vendedora_id?: string | null
        }
        Update: {
          address?: string | null
          archived?: boolean
          cpf?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          id?: string
          loja_id?: string | null
          name?: string
          notes?: string | null
          phone?: string
          updated_at?: string
          vendedora_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_vendedora_id_fkey"
            columns: ["vendedora_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lojas: {
        Row: {
          archived: boolean
          cnpj: string | null
          created_at: string
          created_by: string
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          created_by: string
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          archived?: boolean
          cnpj?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      malinha_products: {
        Row: {
          client_note: string | null
          code: string
          created_at: string
          id: string
          malinha_id: string
          photo_url: string | null
          price: number
          quantity: number
          size: string
          status: Database["public"]["Enums"]["product_status"]
        }
        Insert: {
          client_note?: string | null
          code: string
          created_at?: string
          id?: string
          malinha_id: string
          photo_url?: string | null
          price?: number
          quantity?: number
          size: string
          status?: Database["public"]["Enums"]["product_status"]
        }
        Update: {
          client_note?: string | null
          code?: string
          created_at?: string
          id?: string
          malinha_id?: string
          photo_url?: string | null
          price?: number
          quantity?: number
          size?: string
          status?: Database["public"]["Enums"]["product_status"]
        }
        Relationships: [
          {
            foreignKeyName: "malinha_products_malinha_id_fkey"
            columns: ["malinha_id"]
            isOneToOne: false
            referencedRelation: "malinhas"
            referencedColumns: ["id"]
          },
        ]
      }
      malinhas: {
        Row: {
          client_cpf: string
          client_name: string
          client_phone: string
          created_at: string
          freight_value: number | null
          id: string
          is_return: boolean | null
          logistics_type: string | null
          original_malinha_id: string | null
          seller_name: string
          seller_note: string | null
          status: Database["public"]["Enums"]["malinha_status"]
          updated_at: string
          vendedora_id: string | null
        }
        Insert: {
          client_cpf: string
          client_name: string
          client_phone: string
          created_at?: string
          freight_value?: number | null
          id?: string
          is_return?: boolean | null
          logistics_type?: string | null
          original_malinha_id?: string | null
          seller_name?: string
          seller_note?: string | null
          status?: Database["public"]["Enums"]["malinha_status"]
          updated_at?: string
          vendedora_id?: string | null
        }
        Update: {
          client_cpf?: string
          client_name?: string
          client_phone?: string
          created_at?: string
          id?: string
          seller_name?: string
          seller_note?: string | null
          status?: Database["public"]["Enums"]["malinha_status"]
          updated_at?: string
          vendedora_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendedoras: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          loja_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
          loja_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          loja_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendedoras_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_malinha_for_client: { Args: { _malinha_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_loja_member: {
        Args: { _loja_id: string; _user_id: string }
        Returns: boolean
      }
      update_malinha_client_status: {
        Args: {
          _malinha_id: string
          _status: Database["public"]["Enums"]["malinha_status"]
        }
        Returns: undefined
      }
      update_product_client_statuses: {
        Args: { _malinha_id: string; _products: Json }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "master" | "loja" | "vendedora"
      malinha_status:
        | "Enviada"
        | "Em aberto"
        | "Pedido realizado"
        | "Finalizada"
      product_status: "pending" | "accepted" | "rejected" | "edited"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["master", "loja", "vendedora"],
      malinha_status: [
        "Enviada",
        "Em aberto",
        "Pedido realizado",
        "Finalizada",
      ],
      product_status: ["pending", "accepted", "rejected", "edited"],
    },
  },
} as const
