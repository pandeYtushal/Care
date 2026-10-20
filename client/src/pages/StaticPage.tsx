import { ArrowRight, ShieldCheck, Scale, Lightbulb, Info } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Footer from '../components/Footer';
import BrandMark from '../components/BrandMark';

type LegalPageProps = {
  type: 'privacy' | 'terms' | 'philosophy' | 'about' | 'policies';
};

export default function LegalPage({ type }: LegalPageProps) {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const content = {
    privacy: {
      title: 'Privacy Policy',
      date: 'Effective Date: October 5, 2026',
      sections: [
        {
          title: '1. Information We Collect',
          body: 'We collect personal information that you voluntarily provide to us when registering for an account, expressing an interest in obtaining information about us or our products and services, when participating in activities on the site or otherwise contacting us. The personal information that we collect depends on the context of your interactions with us and the site, the choices you make and the products and features you use.'
        },
        {
          title: '2. How We Use Your Information',
          body: 'We process your information for purposes based on legitimate business interests, the fulfillment of our contract with you, compliance with our legal obligations, and/or your consent. We use the information we collect or receive to facilitate account creation and logon process, to send you administrative information, to fulfill and manage your orders, and for other business purposes.'
        },
        {
          title: '3. Will Your Information Be Shared?',
          body: 'We only share information with your consent, to comply with laws, to provide you with services, to protect your rights, or to fulfill business obligations. We may process or share data based on the following legal basis: Consent, Legitimate Interests, Performance of a Contract, or Legal Obligations.'
        },
        {
          title: '4. How Long Do We Keep Your Information?',
          body: 'We keep your information for as long as necessary to fulfill the purposes outlined in this privacy policy unless otherwise required by law. When we have no ongoing legitimate business need to process your personal information, we will either delete or anonymize it.'
        },
        {
          title: '5. How Do We Keep Your Information Safe?',
          body: 'We have implemented appropriate technical and organizational security measures designed to protect the security of any personal information we process. However, please also remember that we cannot guarantee that the internet itself is 100% secure.'
        },
        {
          title: '6. Essential Cookies',
          body: 'We use essential cookies to keep you signed in, protect your account, and support secure Google sign-in and Google Calendar connection. These cookies support core account and security functions.'
        }
      ]
    },
    terms: {
      title: 'Terms of Service',
      date: 'Effective Date: October 5, 2026',
      sections: [
        {
          title: '1. Agreement to Terms',
          body: 'By accessing our site, you agree to be bound by these Terms of Service and to use the site in accordance with these Terms of Service, our Privacy Policy, and any additional terms and conditions that may apply to specific sections of the site or to products and services available through the site.'
        },
        {
          title: '2. Intellectual Property Rights',
          body: 'Unless otherwise indicated, the site is our proprietary property and all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics on the site (collectively, the "Content") and the trademarks, service marks, and logos contained therein (the "Marks") are owned or controlled by us or licensed to us.'
        },
        {
          title: '3. User Representations',
          body: 'By using the site, you represent and warrant that: (1) all registration information you submit will be true, accurate, current, and complete; (2) you will maintain the accuracy of such information and promptly update such registration information as necessary; (3) you have the legal capacity and you agree to comply with these Terms.'
        },
        {
          title: '4. Prohibited Activities',
          body: 'You may not access or use the site for any purpose other than that for which we make the site available. The site may not be used in connection with any commercial endeavors except those that are specifically endorsed or approved by us.'
        },
        {
          title: '5. Modifications and Interruptions',
          body: 'We reserve the right to change, modify, or remove the contents of the site at any time or for any reason at our sole discretion without notice. We also reserve the right to modify or discontinue all or part of the site without notice at any time.'
        }
      ]
    },
    philosophy: {
      title: 'Our Philosophy',
      date: 'Committed to Thoughtful Care',
      sections: [
        {
          title: 'Care without the rush',
          body: 'Modern medicine has become overly transactional. Patients often feel like just another number in a queue, while clinicians are burnt out by the relentless pace. We believe care works best when there is time to listen. Our practice is designed to remove the friction of traditional healthcare, allowing for unhurried conversations and intentional treatment plans.'
        },
        {
          title: 'Technology as an enabler, not a barrier',
          body: 'We leverage modern technology to streamline scheduling, communication, and record-keeping. However, we never let technology get in the way of the human connection between doctor and patient. Our digital portal is designed to be invisible when you need to focus on care, yet instantly accessible when you need information.'
        },
        {
          title: 'Privacy by default',
          body: 'Your health information is deeply personal. We have built our systems from the ground up with privacy and security as foundational principles. We believe that trust is the cornerstone of any therapeutic relationship, and protecting your data is our first step in earning that trust.'
        }
      ]
    },
    about: {
      title: 'About Dr. Kiran',
      date: 'A private practice for thoughtful consultations',
      sections: [
        {
          title: 'A conversation shaped around you',
          body: 'A consultation is a chance to explain what has been happening, share relevant questions or reports, and discuss possible next steps with Dr. Kiran.'
        },
        {
          title: 'Appointments and your records',
          body: 'The patient portal lets you request an available consultation, follow appointment updates, and keep shared reports and visit information together.'
        }
      ]
    },
    policies: {
      title: 'Booking & practice policies',
      date: 'Please review before requesting a consultation',
      sections: [
        {
          title: 'Booking requests and confirmation',
          body: 'Choosing a time sends a request to the practice. Your appointment is not confirmed until the practice accepts it. Check your patient portal for the latest status and appointment details.'
        },
        {
          title: 'Consultation methods and scope',
          body: 'The available consultation format is shown on each service before you request a time. Current options may include Google Meet, WhatsApp, or an in-person visit, depending on the service configuration. Topics listed on this site are for discussion; the clinician will decide whether a consultation is suitable and what next steps are appropriate.'
        },
        {
          title: 'Fees and payment',
          body: 'Any fee shown with a consultation is an estimate or quote from the practice. Online payment is not currently available through this website. Do not enter card or bank details here. The practice will explain any applicable payment arrangements directly.'
        },
        {
          title: 'Cancellation and rescheduling',
          body: 'Use the appointment in your patient portal to contact the practice about a cancellation or a different time. A requested change is not complete until the practice confirms it. If you cannot access your account, use the demo contact details below.'
        },
        {
          title: 'Refunds',
          body: 'This website does not currently collect payments or issue refunds. If you paid the practice through another channel and need help with a refund, contact the practice using the details below and include your appointment date and payment reference. Confirm the practice’s final refund terms before making a payment.'
        },
        {
          title: 'Feedback, complaints, and urgent care',
          body: 'For feedback or a complaint about a booking or consultation, contact the practice using the details below and include how you would prefer to be contacted. This website and its messaging features are not for emergencies. For urgent or emergency care, contact local emergency services.'
        }
      ]
    }
  };

  const data = content[type];
  const legal = type === 'privacy' || type === 'terms' || type === 'policies';

  // Map type to an icon
  const getIcon = () => {
    switch (type) {
      case 'privacy': return <ShieldCheck size={27} aria-hidden="true" />;
      case 'terms': return <Scale size={27} aria-hidden="true" />;
      case 'philosophy': return <Lightbulb size={27} aria-hidden="true" />;
      case 'about': return <Info size={27} aria-hidden="true" />;
      case 'policies': return <ShieldCheck size={27} aria-hidden="true" />;
      default: return null;
    }
  };

  return (
    <div className="static-page">
      <header className="static-page__header">
        <div className="static-page__header-inner">
          <Link className="static-page__brand" to="/">
            <BrandMark className="static-page__brand-icon" />
            <span>Dr. Kiran</span>
          </Link>
          <Link to="/" className="static-page__return">
            <ArrowRight size={14} className="rotate-180 inline mr-2" aria-hidden="true" /> Back to practice
          </Link>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        <div className={`static-page__hero static-page__hero--${type}`}>
          <div className="static-page__hero-inner">
            <div className="static-page__hero-copy">
              <span className="static-page__eyebrow">{legal ? 'Practice information' : 'Meet the practice'}</span>
              <h1>{data.title}</h1>
              <p>{data.date}</p>
            </div>
            <div className="static-page__icon" aria-hidden="true">{getIcon()}</div>
          </div>
        </div>

        <div className="static-page__body">
          <article className="static-page__article" aria-label={data.title}>
            {data.sections.map((section, idx) => (
              <section key={idx} className="static-page__section">
                <span className="static-page__number">{String(idx + 1).padStart(2, '0')}</span>
                <div><h2>{section.title}</h2><p>{section.body}</p></div>
              </section>
            ))}
          </article>

          {type === 'policies' && (
            <section className="practice-policy-contact" aria-labelledby="policy-contact-title">
              <span className="static-page__eyebrow">Demo details</span>
              <h2 id="policy-contact-title">Contact the practice</h2>
              <p>These are temporary demo details for the current build. Replace them with the practice’s confirmed contact information before launch.</p>
              <dl>
                <div><dt>Email</dt><dd><a href="mailto:care@ateliercare.example">care@ateliercare.example</a></dd></div>
                <div><dt>Phone</dt><dd>+91 00000 00000 <span>(demo number)</span></dd></div>
                <div><dt>Clinician</dt><dd>Dr. Kiran <span>— professional registration details to be supplied by the practice</span></dd></div>
              </dl>
            </section>
          )}

          {type === 'about' && (
            <section className="about-care-focus" aria-labelledby="about-care-focus-title">
              <div className="about-care-focus__heading">
                <span className="static-page__eyebrow">Consultation topics</span>
                <h2 id="about-care-focus-title">Areas of care</h2>
                <p>These concerns can be brought to a consultation. The clinician will discuss what assessment or next steps may be appropriate.</p>
              </div>
              <div className="about-care-focus__groups">
                <div><h3>Women's and uterine health</h3><ul><li>Uterine conditions</li><li>Ovarian cysts</li><li>Uterine fibroids</li><li>Irregular menstruation</li><li>Infertility</li></ul></div>
                <div><h3>Other concerns</h3><ul><li>Kidney stones</li><li>Chronic disease</li></ul></div>
              </div>
            </section>
          )}

          <div className="static-page__cta">
            <Link to={type === 'policies' ? '/services' : legal ? '/' : '/patient/book'} className="btn btn-primary">
              {type === 'policies' ? 'View consultation options' : legal ? 'Return to the practice' : 'View consultation options'} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
