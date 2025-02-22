import React from 'react';
import { 
  Container, 
  Typography, 
  Paper, 
  Box,
  TextField,
  Button,
  Grid 
} from '@mui/material';

function Contact() {
  return (
    <Container maxWidth="md">
      <Paper sx={{ p: 4, my: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ color: '#00ff00' }}>
          Contact Us
        </Typography>
        <Box component="form" sx={{ mt: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Name"
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                variant="outlined"
                type="email"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Subject"
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Message"
                variant="outlined"
                multiline
                rows={4}
              />
            </Grid>
            <Grid item xs={12}>
              <Button 
                variant="contained" 
                size="large"
                sx={{ 
                  background: 'linear-gradient(45deg, #00ff00, #00cc00)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #00cc00, #009900)'
                  }
                }}
              >
                Send Message
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Container>
  );
}

export default Contact;
