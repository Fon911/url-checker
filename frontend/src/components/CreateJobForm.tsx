import { useState } from 'react';
import type { FormEvent } from 'react';
import { useJobsStore } from '../store/jobs';
import styles from './CreateJobForm.module.css';

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export function CreateJobForm() {
  const [text, setText] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const creating = useJobsStore((state) => state.creating);
  const createError = useJobsStore((state) => state.createError);
  const createJob = useJobsStore((state) => state.createJob);

  const urls = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const invalid = urls.find((url) => !isHttpUrl(url));
    if (invalid) {
      setValidationError(`Некорректный URL: ${invalid}`);
      return;
    }
    if (await createJob(urls)) {
      setText('');
    }
  };

  const error = validationError ?? createError;

  return (
    <form className={`card ${styles.form}`} onSubmit={onSubmit}>
      <h2 className={styles.title}>Новая проверка</h2>
      <p className={styles.hint}>По одному URL на строке</p>
      <textarea
        className={styles.textarea}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setValidationError(null);
        }}
        placeholder={'https://example.com\nhttps://google.com'}
        rows={6}
        spellCheck={false}
      />
      <button className="button" type="submit" disabled={creating || urls.length === 0}>
        {creating ? 'Запускаем…' : 'Запустить проверку'}
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </form>
  );
}
