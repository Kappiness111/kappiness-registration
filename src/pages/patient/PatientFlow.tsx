import { useCallback, useEffect, useMemo, useState } from 'react';
import LandingPage from './LandingPage';
import TermsPage from './TermsPage';
import RegistrationPage, { type FormState } from './RegistrationPage';
import SuccessPage from './SuccessPage';
import SimpleLayout from '../../layouts/SimpleLayout';
import { CrisisDialog, PrivacyDialog } from '../../components/InfoDialogs';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { createInitialValues } from '../../features/registration/types';
import { uuid } from '../../lib/uuid';
import { isPreviewMode } from '../../lib/api';

/**
 * Home → Terms → (tick + "I Agree & Continue") → Form → Thank you.
 * The form is only rendered after the terms are accepted. Answers live in
 * memory only: nothing goes to localStorage, sessionStorage, cookies or the URL.
 */
type View = 'landing' | 'terms' | 'form' | 'success';

const freshForm = (): FormState => ({ values: createInitialValues(), submissionKey: uuid() });

export default function PatientFlow() {
  const [view, setView] = useState<View>(() =>
    isPreviewMode && new URLSearchParams(window.location.search).get('preview') === 'thanks' ? 'success' : 'landing',
  );
  const [agreement, setAgreement] = useState({ checked: false, accepted: false, acceptedAt: '' });
  const [form, setForm] = useState<FormState>(freshForm);
  // Preview shortcut (no backend connected only): open /?preview=thanks to see the thank-you page.
  // Only what the thank-you page needs, kept in memory: first name and last 4 phone digits.
  const [result, setResult] = useState<{ firstName: string; phoneLast4: string; preview: boolean } | null>(() =>
    isPreviewMode && new URLSearchParams(window.location.search).get('preview') === 'thanks'
      ? { firstName: 'Anjali', phoneLast4: '2345', preview: true } // sample, preview only
      : null,
  );
  const [dialog, setDialog] = useState<'privacy' | 'crisis' | 'leave' | null>(null);

  const dirty = useMemo(() => {
    const init = createInitialValues();
    return (Object.keys(init) as (keyof typeof init)[]).some((k) => k !== 'consentDate' && form.values[k] !== init[k]);
  }, [form.values]);

  const resolve = useCallback(
    (target: View): View => {
      if (target === 'form' && !agreement.accepted) return 'terms';
      if (target === 'success' && !result) return 'landing';
      return target;
    },
    [agreement.accepted, result],
  );

  const show = useCallback((next: View, mode: 'push' | 'replace' = 'push') => {
    setView(next);
    window.history[mode === 'push' ? 'pushState' : 'replaceState']({ view: next }, '');
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  useEffect(() => {
    window.history.replaceState({ view }, ''); // eslint-disable-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const target = (e.state?.view as View) ?? 'landing';
      setView(result && (target === 'form' || target === 'success') ? 'landing' : resolve(target));
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [resolve, result]);

  useEffect(() => {
    if (!dirty || view === 'success') return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty, view]);

  useEffect(() => {
    document.title = { landing: 'Kappiness', terms: 'Before we begin · Kappiness', form: 'Registration · Kappiness', success: 'Thank you · Kappiness' }[view];
  }, [view]);

  const resetAll = () => {
    setForm(freshForm());
    setAgreement({ checked: false, accepted: false, acceptedAt: '' });
  };

  const goHome = () => {
    if (view === 'form' && dirty) return setDialog('leave');
    if (view === 'success') {
      setResult(null);
      return show('landing', 'replace');
    }
    show('landing');
  };

  const dialogs = (
    <>
      <PrivacyDialog open={dialog === 'privacy'} onClose={() => setDialog(null)} />
      <CrisisDialog open={dialog === 'crisis'} onClose={() => setDialog(null)} />
      <Modal
        open={dialog === 'leave'}
        onClose={() => setDialog(null)}
        title="Leave this page?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)} block className="sm:w-auto">
              Stay
            </Button>
            <Button
              block
              className="sm:w-auto"
              onClick={() => {
                setDialog(null);
                resetAll();
                show('landing');
              }}
            >
              Leave
            </Button>
          </>
        }
      >
        <p className="text-[16px] leading-relaxed text-stone">Your answers aren’t saved anywhere until you submit, so they’ll be cleared.</p>
      </Modal>
    </>
  );

  if (view === 'landing') {
    return (
      <>
        <LandingPage onBegin={() => show(resolve('terms'))} onPrivacy={() => setDialog('privacy')} onCrisis={() => setDialog('crisis')} />
        {dialogs}
      </>
    );
  }

  const layout = { onHome: goHome, onPrivacy: () => setDialog('privacy'), onCrisis: () => setDialog('crisis') };

  return (
    <>
      {view === 'form' && agreement.accepted ? (
        <SimpleLayout
          {...layout}
          step={3}
          onBack={() => show('terms')}
          title={
            <>
              Almost there,
              <br />
              tell us about you
            </>
          }
          intro={
            <>
              One page, about a minute. Fields marked <span className="text-honey">*</span> are required.
            </>
          }
        >
          <RegistrationPage
            form={form}
            setForm={setForm}
            termsAcceptedAt={agreement.acceptedAt}
            onReviewTerms={() => show('terms')}
            onSubmitted={(_registrationId, preview) => {
              setResult({
                firstName: form.values.fullName.trim().split(/\s+/)[0] ?? '',
                phoneLast4: form.values.mobilePhone.replace(/\D/g, '').slice(-4),
                preview,
              });
              resetAll(); // clear personal data from memory
              show('success', 'replace');
            }}
          />
        </SimpleLayout>
      ) : view === 'success' && result ? (
        <SimpleLayout
          {...layout}
          step={4}
          title="Thank You for Choosing Kappiness."
          intro="Your registration has been successfully received. Taking this step towards your well-being matters to us. Our team will contact you regarding the next steps."
        >
          <SuccessPage
            firstName={result.firstName}
            phoneLast4={result.phoneLast4}
            preview={result.preview}
            onHome={() => {
              setResult(null);
              show('landing', 'replace');
            }}
          />
        </SimpleLayout>
      ) : (
        <SimpleLayout
          {...layout}
          step={2}
          onBack={() => show('landing')}
          title="Before we begin."
          intro="Please take a moment to understand the terms of your registration."
        >
          <TermsPage
            agreed={agreement.checked}
            onAgreedChange={(checked) => setAgreement((a) => (checked ? { ...a, checked } : { checked: false, accepted: false, acceptedAt: '' }))}
            onContinue={() => {
              if (!agreement.checked) return;
              setAgreement((a) => ({ ...a, accepted: true, acceptedAt: a.acceptedAt || new Date().toISOString() }));
              show('form');
            }}
          />
        </SimpleLayout>
      )}
      {dialogs}
    </>
  );
}
