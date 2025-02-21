import React from 'react';
import { Box, Container, Grid, Typography, Stack, Link } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import config from '../utils/config';

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <Box
      component="footer"
      sx={{
        py: 3,
        px: 2,
        mt: 'auto',
        backgroundColor: theme => theme.palette.mode === 'dark' 
          ? 'rgba(26, 26, 26, 0.8)'
          : 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(8px)',
        borderTop: theme => `1px solid ${
          theme.palette.mode === 'dark' 
            ? 'rgba(255, 255, 255, 0.1)'
            : 'rgba(0, 0, 0, 0.1)'
        }`
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4}>
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary" align="center">
              © 2023 - {currentYear} {config.footer.copyright}
            </Typography>
            <Stack 
              direction="row" 
              spacing={3} 
              justifyContent="center" 
              mt={2}
            >
              {config.footer.links.map((link, index) => (
                <Link
                  key={index}
                  component={RouterLink}
                  to={link.url}
                  color="inherit"
                  sx={{ 
                    textDecoration: 'none',
                    '&:hover': { color: 'primary.main' }
                  }}
                >
                  {link.text}
                </Link>
              ))}
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export default Footer;