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

        router.push("/ranking-eliminatoria");
        return;
      }

      await signInWithEmailAndPassword(auth, email, password);
      router.push("/ranking-eliminatoria");
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
    <main className="relative min-h-screen overflow-hidden bg-slate-950 px-6 py-10 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.35),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(37,99,235,0.35),_transparent_35%)]" />

      <div className="absolute inset-0 opacity-[0.08]">
        <div className="h-full w-full bg-[linear-gradient(90deg,_white_1px,_transparent_1px),linear-gradient(white_1px,_transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <section className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center">
        <div className="grid w-full gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="hidden lg:block">
            <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-green-100 backdrop-blur">
              🏆 Quiniela Mundial
            </div>

            <h1 className="mt-6 max-w-2xl text-6xl font-black leading-tight tracking-tight">
              Predice. Compite. Celebra cada gol.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
              Registra tus marcadores antes de cada partido, suma puntos por
              tus aciertos y pelea el liderato del ranking general.
            </p>

            <div className="mt-10 grid max-w-xl grid-cols-3 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur">
                <p className="text-3xl font-black text-green-300">3</p>
                <p className="mt-1 text-sm text-slate-300">
                  puntos por marcador exacto
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur">
                <p className="text-3xl font-black text-blue-300">1</p>
                <p className="mt-1 text-sm text-slate-300">
                  punto por ganador o empate
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur">
                <p className="text-3xl font-black text-yellow-300">🏅</p>
                <p className="mt-1 text-sm text-slate-300">
                  ranking en tiempo real
                </p>
              </div>
            </div>

            <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/10 p-6 backdrop-blur">
              <div className="relative mx-auto h-56 max-w-xl overflow-hidden rounded-[1.5rem] bg-green-700 shadow-2xl">
                <div className="absolute inset-0 bg-[linear-gradient(90deg,_rgba(255,255,255,0.12)_50%,_transparent_50%)] bg-[size:80px_80px]" />

                <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/60" />
                <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/70" />
                <div className="absolute left-0 top-1/2 h-28 w-16 -translate-y-1/2 border-y-2 border-r-2 border-white/70" />
                <div className="absolute right-0 top-1/2 h-28 w-16 -translate-y-1/2 border-y-2 border-l-2 border-white/70" />

                <div className="absolute left-[18%] top-[42%] flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl shadow-xl">
                  ⚽
                </div>

                <div className="absolute bottom-5 left-5 rounded-full bg-black/40 px-4 py-2 text-sm font-bold text-white backdrop-blur">
                  Próximo partido
                </div>

                <div className="absolute bottom-5 right-5 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-900">
                  2 - 1
                </div>
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-md">
            <div className="rounded-[2rem] border border-white/10 bg-white p-8 text-slate-900 shadow-2xl">
              <div className="mb-8 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">
                  ⚽
                </div>

                <p className="mt-5 text-sm font-black uppercase tracking-[0.25em] text-green-700">
                  Quiniela Mundial
                </p>

                <h2 className="mt-3 text-3xl font-black text-slate-950">
                  {modo === "login" ? "Iniciar sesión" : "Crear cuenta"}
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  {modo === "login"
                    ? "Entra para registrar tus predicciones."
                    : "Crea tu usuario para competir en el ranking."}
                </p>
              </div>

              <form onSubmit={manejarSubmit} className="space-y-5">
                {modo === "registro" && (
                  <div>
                    <label
                      htmlFor="nombre"
                      className="block text-sm font-bold text-slate-700"
                    >
                      Nombre
                    </label>

                    <input
                      id="nombre"
                      type="text"
                      value={nombre}
                      onChange={(event) => setNombre(event.target.value)}
                      required
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-200"
                      placeholder="Ej. Daniel Zambrano"
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-bold text-slate-700"
                  >
                    Correo
                  </label>

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-200"
                    placeholder="correo@ejemplo.com"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-bold text-slate-700"
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
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-200"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>

                {mensajeError && (
                  <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {mensajeError}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={cargando}
                  className="w-full bg-green-600 py-3 text-base hover:bg-green-700 disabled:bg-green-300"
                >
                  {cargando
                    ? "Procesando..."
                    : modo === "login"
                      ? "Entrar a la cancha"
                      : "Crear mi cuenta"}
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
                      className="font-black text-green-700 hover:text-green-800"
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
                      className="font-black text-green-700 hover:text-green-800"
                    >
                      Iniciar sesión
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}