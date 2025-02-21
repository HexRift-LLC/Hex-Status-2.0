const config = {
  footer: {
    copyright: 'Hex Status. All rights reserved.',
    links: [
      { text: 'Privacy Policy', url: '/privacy-policy' },
      { text: 'Terms of Service', url: '/terms-of-service' },
      { text: 'Contact', url: '/contact' }
    ]
  },
  legal: {
    privacyPolicy: {
      title: 'Privacy Policy',
      lastUpdated: '2023-12-01',
      sections: [
        {
          heading: 'Information We Collect',
          content: 'We collect information that you provide directly to us...'
        },
        {
          heading: 'How We Use Your Information',
          content: 'We use the information we collect to provide and improve our services...'
        }
      ]
    },
    termsOfService: {
      title: 'Terms of Service',
      lastUpdated: '2023-12-01',
      sections: [
        {
          heading: 'Agreement to Terms',
          content: 'By accessing our service, you agree to be bound by these terms...'
        },
        {
          heading: 'Use License',
          content: 'Permission is granted to temporarily download one copy of the materials...'
        }
      ]
    }
  }
};

export default config;