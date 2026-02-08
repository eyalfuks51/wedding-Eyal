import { useState } from 'react';
import { submitRsvp } from '../../lib/supabase';
import './RsvpForm.scss';

function RsvpForm() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    attending: null,
    guest_count: 1,
    needs_parking: false,
  });
  const [status, setStatus] = useState('idle'); // idle, loading, success, error
  const [errorMessage, setErrorMessage] = useState('');

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleAttendingClick = (isAttending) => {
    setFormData((prev) => ({
      ...prev,
      attending: isAttending,
      guest_count: isAttending ? prev.guest_count : 0,
      needs_parking: isAttending ? prev.needs_parking : false,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setErrorMessage('נא להזין שם');
      return;
    }

    if (!formData.phone.trim()) {
      setErrorMessage('נא להזין מספר טלפון');
      return;
    }

    const cleanPhone = formData.phone.trim().replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setErrorMessage('נא להזין מספר טלפון בן 10 ספרות');
      return;
    }

    if (formData.attending === null) {
      setErrorMessage('נא לבחור האם מגיעים או לא');
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    try {
      await submitRsvp({
        name: formData.name.trim(),
        phone: formData.phone.trim().replace(/\D/g, ''),
        attending: formData.attending,
        guest_count: formData.attending ? parseInt(formData.guest_count, 10) : 0,
        needs_parking: formData.attending ? formData.needs_parking : false,
      });

      setStatus('success');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error.message || 'אירעה שגיאה. אנא נסו שוב.');
    }
  };

  if (status === 'success') {
    return (
      <section className="rsvp red-border">
        <img src="/frame.png" alt="" className="frame-border-top" />
        <img src="/frame.png" alt="" className="frame-border-bottom" />
        <div className="rsvp__container">
          <div className="rsvp__success">
            <div className="rsvp__success-icon">✓</div>
            <h2 className="rsvp__success-title">
              {formData.attending ? 'תודה רבה!' : 'קיבלנו!'}
            </h2>
            <p className="rsvp__success-text">
              {formData.attending
                ? 'הפרטים שלכם עודכנו! נשמח לראותכם באירוע!'
                : 'הפרטים שלכם עודכנו! תודה שעדכנתם אותנו.'}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rsvp red-border">
      <img src="/frame.png" alt="" className="frame-border-top" />
      <img src="/frame.png" alt="" className="frame-border-bottom" />
      <div className="rsvp__container">
        <h2 className="rsvp__title">אשרו הגעה</h2>
     
    <p className="rsvp__explanation">
    <p className="bold">נשמח לדעת אם תגיעו, כמה תהיו, והאם באים עם רכב.</p>
      ♥  אנחנו רוכשים כרטיסי חניה מראש, תוכלו לעדכן את התשובה שלכם עד שמונה ימים לפני החתונה. 
      <br />
     זכרו לבקש את הכרטיס שלכם כשתגיעו למקום.</p>
        <form className="rsvp__form" onSubmit={handleSubmit}>
          <div className="rsvp__field">
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="rsvp__input"
              placeholder="שם מלא"
              disabled={status === 'loading'}
            />
          </div>

          <div className="rsvp__field">
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className="rsvp__input"
              placeholder="מספר פלאפון"
              disabled={status === 'loading'}
            />
          </div>

          <div className="rsvp__attendance">
            <p className="rsvp__label">האם תגיעו?</p>
            <div className="rsvp__buttons">
              <button
                type="button"
                className={`rsvp__button rsvp__button--attend ${formData.attending === true ? 'rsvp__button--active' : ''}`}
                onClick={() => handleAttendingClick(true)}
                disabled={status === 'loading'}
              >
               בטח שאגיע!
              </button>
              <button
                type="button"
                className={`rsvp__button rsvp__button--decline ${formData.attending === false ? 'rsvp__button--active' : ''}`}
                onClick={() => handleAttendingClick(false)}
                disabled={status === 'loading'}
              >
               לצערי לא
              </button>
            </div>
          </div>

          {formData.attending === true && (
            <div className="rsvp__conditional">
              <div className="rsvp__field">
                <label htmlFor="guest_count" className="rsvp__label">כמה אורחים?</label>
                <select
                  id="guest_count"
                  name="guest_count"
                  value={formData.guest_count}
                  onChange={handleInputChange}
                  className="rsvp__select"
                  disabled={status === 'loading'}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rsvp__field rsvp__field--checkbox">
                <label className="rsvp__checkbox-label">
                  <input
                    type="checkbox"
                    name="needs_parking"
                    checked={formData.needs_parking}
                    onChange={handleInputChange}
                    className="rsvp__checkbox"
                    disabled={status === 'loading'}
                  />
                  <span className="rsvp__checkbox-custom"></span>
                  צריך/ה כרטיס חניה
                </label>
              </div>
            </div>
          )}

          {errorMessage && (
            <p className="rsvp__error">{errorMessage}</p>
          )}

          <button
            type="submit"
            className="rsvp__submit"
            disabled={status === 'loading' || formData.attending === null}
          >
            {status === 'loading' ? 'שולח...' : 'שליחת אישור'}
          </button>
        </form>
      </div>
    </section>
  );
}

export default RsvpForm;
