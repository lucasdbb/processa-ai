import React from 'react';
import { useLocation } from 'react-router-dom';
import Footer from './Footer';

export const FooterWrapper: React.FC = () => {
  const location = useLocation();
  const isCreatePost = location.pathname.startsWith('/admin/posts/edit');

  return <Footer variant={isCreatePost ? 'simple' : 'default'} />;
};
