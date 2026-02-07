import { motion } from "framer-motion";

// @ts-ignore
const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    // @ts-ignore
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;