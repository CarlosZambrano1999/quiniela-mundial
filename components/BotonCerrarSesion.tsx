"use client";

import { useAuth } from "@/lib/context/AuthContext";
import { useRouter } from "next/navigation";
import Button from "./ui/Button";

export default function BotonCerrarSesion() {
  const router = useRouter();
  const { cerrarSesion } = useAuth();

  async function manejarCerrarSesion() {
    await cerrarSesion();
    router.push("/login");
  }

  return (
    <Button type="button" variant="secondary" onClick={manejarCerrarSesion}>
      Cerrar sesión
    </Button>
  );
}