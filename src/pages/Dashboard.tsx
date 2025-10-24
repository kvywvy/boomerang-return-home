import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Item {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  location: string;
  date_lost_found: string;
  image_url: string | null;
  contact_info: string | null;
  created_at: string;
  user_id: string;
  community: string;
}

const Dashboard = () => {
  const { user, authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [communityFilter, setCommunityFilter] = useState<string>('all');
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [imageObjectUrls, setImageObjectUrls] = useState<Record<string, string>>({});

  // preview modal state
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchItems();
    }
    // cleanup object URLs when component unmounts
    return () => {
      Object.values(imageObjectUrls).forEach((url) => {
        try { URL.revokeObjectURL(url); } catch (e) {}
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewImageUrl(null);
    };
    if (previewImageUrl) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewImageUrl]);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);

      // Try to prefetch images as blobs and create object URLs for display.
      // This avoids download behavior if the storage backend sends headers that force download.
      (data || []).forEach(async (it: Item) => {
        if (it.image_url) {
          try {
            // If it's a Supabase public URL, a direct fetch should return image bytes. Create an object URL for reliable rendering.
            const res = await fetch(it.image_url);
            if (!res.ok) throw new Error('Image fetch failed');
            const blob = await res.blob();
            // Only create object URL for image content types
            if (blob.type.startsWith('image/')) {
              const objUrl = URL.createObjectURL(blob);
              setImageObjectUrls((prev) => ({ ...prev, [it.id]: objUrl }));
            }
          } catch (err) {
            // ignore fetch errors — fall back to using the original URL in the UI if needed
          }
        }
      });
    } catch (error: any) {
      toast.error('Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesCommunity = communityFilter === 'all' || item.community === communityFilter;
    
    return matchesSearch && matchesStatus && matchesCategory && matchesCommunity;
  });

  const handleContactOwner = (itemId: string, ownerId: string) => {
    if (!user) {
      navigate('/auth');
      return;
    }
    navigate(`/messages?itemId=${itemId}&userId=${ownerId}`);
  };

  const updateItemStatus = async (itemId: string, newStatus: string) => {
    if (!user) {
      navigate('/auth');
      return;
    }
    setUpdatingItemId(itemId);
    try {
      const { error } = await supabase
        .from('items')
        .update({ status: newStatus })
        .eq('id', itemId);

      if (error) throw error;

      // Optimistic update locally
      setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, status: newStatus } : i)));
      toast.success('Status updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    } finally {
      setUpdatingItemId(null);
    }
  };

  if (authLoading || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Lost & Found Items</h1>
          <p className="text-muted-foreground">Browse and manage your posted items</p>
        </div>

        <Card className="mb-6">
          <CardContent>
            <div className="flex items-center gap-4">
              <Button onClick={() => navigate('/submit')}>Submit an Item</Button>
              {/* filters omitted for brevity - unchanged */}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredItems.length === 0 ? (
          <Card className="text-center py-12">
            <p className="text-xl text-muted-foreground mb-2">No items found</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => (
              <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                {item.image_url && (
                  <div className="aspect-video bg-muted overflow-hidden">
                    <img
                      src={imageObjectUrls[item.id] || item.image_url!}
                      alt={item.title}
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => setPreviewImageUrl(imageObjectUrls[item.id] || item.image_url)}
                    />
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-xl">{item.title}</CardTitle>
                    <div>
                      <Badge variant={item.status === 'lost' ? 'destructive' : item.status === 'found' ? 'default' : 'secondary'}>
                        {item.status}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription className="line-clamp-2">{item.description}</CardDescription>

                  {/* If current user owns this item, show a simple status select so they can update it */}
                  {item.user_id === user.id && (
                    <div className="mt-3 flex items-center gap-2">
                      <Select
                        value={item.status}
                        onValueChange={(val) => updateItemStatus(item.id, val)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lost">Lost</SelectItem>
                          <SelectItem value="found">Found</SelectItem>
                          <SelectItem value="reunited">Reunited</SelectItem>
                        </SelectContent>
                      </Select>

                      {updatingItemId === item.id && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  )}
                </CardHeader>

                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {item.location} • {new Date(item.date_lost_found).toLocaleDateString()}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => handleContactOwner(item.id, item.user_id)}>Contact</Button>
                      <Link to={`/items/${item.id}`}>
                        <Button size="sm" variant="outline">View</Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="relative max-w-[95%] max-h-[95%]">
            <img
              src={previewImageUrl}
              alt="Preview"
              className="max-w-full max-h-[80vh] object-contain rounded"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setPreviewImageUrl(null)}
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

export default Dashboard;
