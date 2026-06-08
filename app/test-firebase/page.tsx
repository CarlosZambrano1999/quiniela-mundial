"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function TestFirebasePage() {
  async function probarConexion() {
    try {
      await addDoc(collection(db, "test"), {
        mensaje: "Firebase conectado correctamente",
        fecha: serverTimestamp(),
      });

      alert("Documento creado en Firebase correctamente");
    } catch (error) {
      console.error(error);
      alert("Error conectando con Firebase");
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-6">
      <section className="max-w-xl w-full rounded-2xl bg-white p-8 shadow">
        <h1 className="text-2xl font-bold text-slate-900">
          Prueba Firebase
        </h1>

        <p className="mt-3 text-slate-600">
          Presiona el botón para crear un documento de prueba en Firestore.
        </p>

        <button
          onClick={probarConexion}
          className="mt-6 rounded-lg bg-blue-600 px-5 py-3 text-white font-medium hover:bg-blue-700"
        >
          Probar conexión
        </button>
      </section>
    </main>
  );
}