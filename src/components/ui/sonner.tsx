import { Toaster as Sonner } from 'sonner';

const Toaster = ({ ...props }) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      swipeDirections={['top', 'right', 'bottom', 'left']}
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-gray-900 group-[.toaster]:text-white group-[.toaster]:border-white/10 group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl',
          description: 'group-[.toast]:text-white/60',
          actionButton:
            'group-[.toast]:bg-white/15 hover:bg-white/20 backdrop-blur-xl border border-white/30 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_14px_rgba(0,0,0,0.3)] group-[.toast]:text-white',
          cancelButton:
            'group-[.toast]:bg-white/10 group-[.toast]:text-white',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
