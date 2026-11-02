import { Navbar } from "@/components/sections/Navbar";
import { Hero } from "@/components/sections/Hero";
import { Services } from "@/components/sections/Services";
import { WhyUs } from "@/components/sections/WhyUs";
import { Process } from "@/components/sections/Process";
import { Work } from "@/components/sections/Work";
import { Testimonials } from "@/components/sections/Testimonials";
import { Faq } from "@/components/sections/Faq";
import { Contact } from "@/components/sections/Contact";
import { Footer } from "@/components/sections/Footer";
import { OrganizationJsonLd } from "@/components/OrganizationJsonLd";
import { isLinkHidden } from "@/lib/content-model";
import { siteChrome } from "@/lib/site-chrome";
import type { SectionId } from "@/lib/content-spec";
import { getSiteView } from "@/server/content";

/**
 * The page text comes from the database (what the admin saved in "محتوى الموقع") laid over the text in the code, and is
 * cached until the next save. A section switched off, or left with nothing to show, is skipped together with every
 * menu / footer / button link that pointed at it, and the "// 01" numbers close up around it.
 */
export default async function Home() {
  const view = await getSiteView();
  const { content, hidden, indexes } = view;
  const shown = (id: SectionId) => !hidden.includes(id);
  const at = (id: SectionId) => indexes[id] ?? "";
  const { nav, footer } = siteChrome(view);

  return (
    <>
      <OrganizationJsonLd />
      <Navbar nav={nav} />
      <main id="main">
        <Hero hero={content.hero} showSecondary={!isLinkHidden(content.hero.secondaryCta.href, hidden)} />
        {shown("services") ? <Services data={content.services} index={at("services")} /> : null}
        {shown("why") ? <WhyUs data={content.why} index={at("why")} /> : null}
        {shown("process") ? <Process data={content.process} index={at("process")} /> : null}
        {shown("work") ? <Work data={content.work} index={at("work")} /> : null}
        {shown("testimonials") ? <Testimonials data={content.testimonials} index={at("testimonials")} /> : null}
        {shown("faq") ? <Faq data={content.faq} index={at("faq")} /> : null}
        <Contact data={content.contact} index={at("contact")} />
      </main>
      <Footer footer={footer} />
    </>
  );
}
