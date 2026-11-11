import { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  /** Show the lock icon at the left, as in the sign-in form. */
  withIcon?: boolean;
};

/** Password field with a show/hide toggle, so clients can check what they typed. */
export function PasswordInput({ withIcon = true, className = '', ...props }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      {withIcon && (
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Lock className="h-5 w-5 text-gray-400" />
        </div>
      )}
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={`w-full ${withIcon ? 'pl-10' : 'pl-3'} pr-11 py-2.5 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-marca-negro"
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
}
