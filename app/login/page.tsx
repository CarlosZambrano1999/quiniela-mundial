"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type ModoFormulario = "login" | "registro";

export default function LoginPage() {
  const router = useRouter();

  const [modo, setModo] = useState<ModoFormulario>("login");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [cargando, setCargando] = useState(false);
  const [mensajeError, setMensajeError] = useState("");

  async function manejarSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMensajeError("");
    setCargando(true);

    try {
      if (modo === "registro") {
        const credencial = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

        await updateProfile(credencial.user, {
          displayName: nombre,
        });

        await setDoc(doc(db, "users", credencial.user.uid), {
          uid: credencial.user.uid,
          nombre,
          email,
          rol: "participante",
          puntosTotales: 0,
          fechaCreacion: serverTimestamp(),
        });

        router.push("/quiniela");
        return;
      }

      await signInWithEmailAndPassword(auth, email, password);
      router.push("/quiniela");
    } catch (error) {
      console.error(error);
      setMensajeError(obtenerMensajeError(error));
    } finally {
      setCargando(false);
    }
  }

  function obtenerMensajeError(error: unknown) {
    if (typeof error !== "object" || error === null || !("code" in error)) {
      return "Ocurrió un error inesperado.";
    }

    const codigo = String(error.code);

    switch (codigo) {
      case "auth/email-already-in-use":
        return "Este correo ya está registrado.";
      case "auth/invalid-email":
        return "El correo no tiene un formato válido.";
      case "auth/weak-password":
        return "La contraseña debe tener al menos 6 caracteres.";
      case "auth/invalid-credential":
        return "Correo o contraseña incorrectos.";
      case "auth/missing-password":
        return "Debes ingresar una contraseña.";
      default:
        return "No se pudo completar la operación. Intenta nuevamente.";
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-blue-50 px-6 py-10">
    <div className="w-full max-w-md">
        <Card>
        <p className="text-sm font-semibold text-blue-600">
          Quiniela Mundial
        </p>

        <h1 className="mt-3 text-3xl font-bold text-slate-900">
          {modo === "login" ? "Iniciar sesión" : "Crear cuenta"}
        </h1>

        <p className="mt-2 text-slate-600">
          {modo === "login"
            ? "Ingresa para registrar tus predicciones."
            : "Regístrate para participar en la quiniela."}
        </p>

        <form onSubmit={manejarSubmit} className="mt-8 space-y-5">
          {modo === "registro" && (
            <div>
              <label
                htmlFor="nombre"
                className="block text-sm font-medium text-slate-700"
              >
                Nombre
              </label>

              <input
                id="nombre"
                type="text"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                required
                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Ej. Daniel Zambrano"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700"
            >
              Correo
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              placeholder="correo@ejemplo.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700"
            >
              Contraseña
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          {mensajeError && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {mensajeError}
            </div>
          )}

          <Button type="submit" disabled={cargando} className="w-full">
            {cargando
                ? "Procesando..."
                : modo === "login"
                ? "Iniciar sesión"
                : "Crear cuenta"}
            </Button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-600">
          {modo === "login" ? (
            <>
              ¿No tienes cuenta?{" "}
              <button
                type="button"
                onClick={() => {
                  setModo("registro");
                  setMensajeError("");
                }}
                className="font-semibold text-blue-600 hover:text-blue-700"
              >
                Crear cuenta
              </button>
            </>
          ) : (
            <>
              ¿Ya tienes cuenta?{" "}
              <button
                type="button"
                onClick={() => {
                  setModo("login");
                  setMensajeError("");
                }}
                className="font-semibold text-blue-600 hover:text-blue-700"
              >
                Iniciar sesión
              </button>
            </>
          )}
        </div>
      </Card>
  </div>
</main>
  );
}