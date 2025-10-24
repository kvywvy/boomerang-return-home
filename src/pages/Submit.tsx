import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Upload, ArrowLeft } from 'lucide-react';
import { z } from 'zod';

const itemSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(100, 'Title too long'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(1000, 'Description too long'),
  category: z.string().min(1, 'Please select a category'),
  status: z.string().min(1, 'Please select a status'),
  location: z.string().min(3, 'Location must be at least 3 characters').max(200, 'Location too long'),
  date_lost_found: z.string().min(1, 'Please select a date'),
  contact_info: z.string().max(200, 'Contact info too long').optional(),
});

const Submit = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [community, setCommunity] = useState('public');

  // Preview modal state
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  useEffect(() => {
    // cleanup preview URL when component unmounts
    return () => {
      if (imagePreview) {
        try { URL.revokeObjectURL(imagePreview); } catch {}
      }
    };
  }, [imagePreview]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowPreviewModal(false);
    };
    if (showPreviewModal) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showPreviewModal]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      // revoke old preview if present
      if (imagePreview) {
        try { URL.revokeObjectURL(imagePreview); } catch {}
      }
      setImageFile(file);
      const objUrl = URL.createObjectURL(file);
      setImagePreview(objUrl);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) {
      toast.error('You must be logged in to submit an item');
      navigate('/auth');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const data = {
        title: formData.get('title') as string,
        description: formData.get('description') as string,
        category: formData.get('category') as string,
        status: formData.get('status') as string,
        location: formData.get('location') as string,
        date_lost_found: formData.get('date_lost_found') as string,
        contact_info: formData.get('contact_info') as string,
      };

      itemSchema.parse(data);

      let imageUrl = null;

      // Upload image if provided
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        // Upload and try to preserve metadata (Supabase client will normally use file.type)
        // Passing options like cacheControl/upsert can help avoid unexpected downloads in some setups.
        const { error: uploadError } = await supabase.storage
          .from('item-images')
          .upload(fileName, imageFile, { cacheControl: '3600', upsert: false });

        if (uploadError) {
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('item-images')
          .getPublicUrl(fileName);

        imageUrl = publicUrl;
      }

      // Insert item
      const { error: insertError } = await supabase
        .from('items')
        .insert([{
          user_id: user.id,
          title: data.title,
          description: data.description,
          category: data.category as any,
          status: data.status as any,
          location: data.location,
          date_lost_found: data.date_lost_found,
          contact_info: data.contact_info || null,
          image_url: imageUrl,
          community: community as any,
        }]);

      if (insertError) throw insertError;

      toast.success('Item submitted successfully!');
      // revoke preview after successful upload
      if (imagePreview) {
        try { URL.revokeObjectURL(imagePreview); } catch {}
        setImagePreview(null);
        setImageFile(null);
      }
      navigate('/dashboard');
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || 'Failed to submit item');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Submit an Item</CardTitle>
            <CardDescription>
              Help reunite lost items with their owners or let others know you've found something
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Item Title *</Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="e.g., Black iPhone 14 Pro"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Provide details about the item..."
                  rows={4}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status *</Label>
                  <Select name="status" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lost">Lost</SelectItem>
                      <SelectItem value="found">Found</SelectItem>
                      <SelectItem value="reunited">Reunited</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select name="category" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="electronics">Electronics</SelectItem>
                      <SelectItem value="accessories">Accessories</SelectItem>
                      <SelectItem value="documents">Documents</SelectItem>
                      <SelectItem value="clothing">Clothing</SelectItem>
                      <SelectItem value="pets">Pets</SelectItem>
                      <SelectItem value="keys">Keys</SelectItem>
                      <SelectItem value="bags">Bags</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Location *</Label>
                  <Input id="location" name="location" placeholder="e.g., Library" required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date_lost_found">Date *</Label>
                  <Input id="date_lost_found" name="date_lost_found" type="date" required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_info">Contact Information (Optional)</Label>
                <Input
                  id="contact_info"
                  name="contact_info"
                  placeholder="Email or phone number"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="image">Item Photo (Optional)</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="cursor-pointer"
                  />
                  {imagePreview && (
                    <button
                      type="button"
                      onClick={() => setShowPreviewModal(true)}
                      className="h-20 w-20 p-0 rounded border overflow-hidden"
                      aria-label="Open image preview"
                    >
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="h-full w-full object-cover"
                      />
                    </button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">Max file size: 5MB</p>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Submit Item
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Preview Modal */}
      {showPreviewModal && imagePreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowPreviewModal(false)}
        >
          <div className="relative max-w-[95%] max-h-[95%]">
            <img
              src={imagePreview}
              alt="Image preview"
              className="max-w-full max-h-[80vh] object-contain rounded"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setShowPreviewModal(false)}
              className="absolute top-2 right-2 bg-white/90 rounded px-3 py-1 text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Submit;
