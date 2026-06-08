"use client";

import {
  User,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import {
  doc,
  getDoc,
} from "firebase/firestore";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { auth, db } from "@/lib/firebase";

type PerfilUsuario = {
  uid: string;
  nombre: string;
  email: string;
  rol: "participante" | "admin";
  puntosTotales: number;
};

type AuthContextType = {
  usuario: User | null;
  perfil: PerfilUsuario | null;
  cargando: boolean;
  cerrarSesion: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (usuarioFirebase) => {
      setUsuario(usuarioFirebase);

      if (!usuarioFirebase) {
        setPerfil(null);
        setCargando(false);
        return;
      }

      const perfilRef = doc(db, "users", usuarioFirebase.uid);
      const perfilSnap = await getDoc(perfilRef);

      if (perfilSnap.exists()) {
        setPerfil(perfilSnap.data() as PerfilUsuario);
      } else {
        setPerfil(null);
      }

      setCargando(false);
    });

    return () => unsubscribe();
  }, []);

  async function cerrarSesion() {
    await signOut(auth);
    setUsuario(null);
    setPerfil(null);
  }

  return (
    <AuthContext.Provider
      value={{
        usuario,
        perfil,
        cargando,
        cerrarSesion,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const contexto = useContext(AuthContext);

  if (!contexto) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }

  return contexto;
}