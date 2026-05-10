import { ArrowLeft, Shield } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 overflow-hidden rounded-lg bg-dropit-accent shadow-sm">
              <img src="/dropit-logo.jpeg" alt="DropIt" className="h-full w-full object-cover" />
            </div>
            <span className="text-lg font-black text-dropit-950">
              Drop<span className="text-dropit-accent">It</span>
            </span>
          </div>
          <a
            href="/cotizar"
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-dropit-accent transition-colors"
          >
            <ArrowLeft size={16} />
            Volver al cotizador
          </a>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-4 py-16">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-dropit-accent/10">
            <Shield size={24} className="text-dropit-accent" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-dropit-accent">Legal</p>
            <h1 className="text-3xl font-black text-dropit-950">Política de privacidad</h1>
          </div>
        </div>
        <p className="mb-8 text-sm text-slate-500">Última actualización: 1 de mayo de 2026</p>

        <div className="prose prose-slate max-w-none space-y-8 text-slate-700 leading-relaxed">
          <section>
            <h2 className="mb-2 text-lg font-bold text-dropit-950">1. Responsable del tratamiento</h2>
            <p>
              DropIt Service SpA, con domicilio en Santiago, Chile, es responsable del tratamiento de los datos personales
              recopilados a través de nuestros servicios de cotización, seguimiento y gestión logística.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-dropit-950">2. Datos que recopilamos</h2>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Nombre completo y nombre de la empresa</li>
              <li>Correo electrónico y número de teléfono</li>
              <li>Dirección de retiro y entrega (origen y destino)</li>
              <li>Descripción y características de la carga</li>
              <li>Información de seguimiento de envíos</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-dropit-950">3. Finalidad del tratamiento</h2>
            <p className="text-sm">
              Utilizamos tus datos para procesar cotizaciones, coordinar retiros y entregas, enviar comunicaciones
              relacionadas con tu servicio, y mejorar la experiencia de nuestros clientes. No vendemos ni compartimos
              tus datos con terceros con fines comerciales.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-dropit-950">4. Base legal</h2>
            <p className="text-sm">
              El tratamiento de tus datos se basa en la ejecución del contrato de servicio de transporte y/o en tu
              consentimiento otorgado al completar el formulario de cotización, en conformidad con la Ley N° 19.628
              sobre Protección de la Vida Privada de Chile.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-dropit-950">5. Conservación de los datos</h2>
            <p className="text-sm">
              Conservamos tus datos mientras exista una relación comercial activa y por un período de 5 años
              posteriores para cumplir obligaciones legales y fiscales.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-dropit-950">6. Tus derechos</h2>
            <p className="text-sm">
              Tienes derecho a acceder, rectificar, cancelar u oponerte al tratamiento de tus datos personales.
              Para ejercer estos derechos contáctanos en:
            </p>
            <p className="mt-2 text-sm font-semibold text-dropit-accent">privacidad@dropit.cl</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-dropit-950">7. Seguridad</h2>
            <p className="text-sm">
              Implementamos medidas técnicas y organizativas adecuadas para proteger tus datos contra acceso no
              autorizado, pérdida o divulgación. Las transmisiones de datos se realizan sobre conexiones HTTPS cifradas.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-dropit-950">8. Cookies</h2>
            <p className="text-sm">
              Nuestro sitio utiliza cookies de sesión estrictamente necesarias para el funcionamiento del panel
              operativo. No utilizamos cookies de rastreo o publicidad de terceros.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-dropit-950">9. Cambios a esta política</h2>
            <p className="text-sm">
              Podemos actualizar esta política en cualquier momento. Te notificaremos de cambios significativos
              por correo electrónico o mediante un aviso en el sitio.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-dropit-950 px-4 py-8 text-white mt-8">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm text-dropit-500">
            © 2026 DropIt Service · Santiago, Chile
          </p>
        </div>
      </footer>
    </div>
  );
}
