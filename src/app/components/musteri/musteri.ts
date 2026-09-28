import { Component, OnInit, ChangeDetectorRef, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-musteri',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './musteri.html',
  styleUrl: './musteri.css',
  encapsulation: ViewEncapsulation.None
})
export class MusteriComponent implements OnInit {
  currentUser: any = { id: null, name: '', email: '', phone: '', role: 'user', profile_image: '' };
  listings: any[] = [];
  favoriteIds: number[] = [];

  activeTab: 'all' | 'favorites' | 'my-listings' | 'admin-panel' | 'messages' | 'settings' | 'friends' | 'user-profile' = 'all';
  showAddModal: boolean = false;
  selectedListing: any = null;
  activeImageIndex: number = 0;

  listingComments: any[] = [];
  newCommentText: string = '';
  messages: any[] = [];
  directMessageText: string = '';

  activeChatUser: any = null;
  activeChatMessages: any[] = [];
  messengerInputText: string = '';

  friendSearchQuery: string = '';
  searchResults: any[] = [];
  friendsList: any[] = [];

  // Navbar Kullanıcı Arama
  navUserSearchQuery: string = '';
  navSearchResults: any[] = [];
  viewedUserProfile: any = null;
  viewedUserListings: any[] = [];

  selectedCity: string = '';
  selectedBrand: string = '';
  selectedModel: string = '';
  minPrice: number | null = null;
  maxPrice: number | null = null;

  brandModels: { [key: string]: string[] } = {
    'BMW': ['1 Serisi', '2 Serisi', '3 Serisi', '4 Serisi', '5 Serisi', '7 Serisi', 'X1', 'X3', 'X5', 'X6'],
    'Mercedes-Benz': ['A Serisi', 'C Serisi', 'E Serisi', 'S Serisi', 'CLA', 'GLA', 'GLC', 'GLE'],
    'Audi': ['A3', 'A4', 'A5', 'A6', 'Q3', 'Q5', 'Q7'],
    'Volkswagen': ['Polo', 'Golf', 'Passat', 'Tiguan', 'T-Roc'],
    'Ford': ['Fiesta', 'Focus', 'Kuga', 'Puma', 'Mustang'],
    'Renault': ['Clio', 'Megane', 'Captur', 'Austral'],
    'Toyota': ['Corolla', 'Yaris', 'C-HR', 'RAV4'],
    'Fiat': ['Egea', 'Linea', 'Fiorino', 'Doblo', '500'],
    'Opel': ['Astra', 'Corsa', 'Mokka', 'Grandland'],
    'Peugeot': ['208', '308', '2008', '3008']
  };

  brands: string[] = Object.keys(this.brandModels);
  availableModels: string[] = [];
  availableModalModels: string[] = [];
  cities: string[] = ['Adana', 'Ankara', 'Antalya', 'Bursa', 'Gaziantep', 'İstanbul', 'İzmir', 'Kayseri', 'Kocaeli', 'Konya', 'Trabzon'];

  newListingData = {
    title: '', brand: '', model: '', year: 2024, fuel_type: 'Benzin', gear_type: 'Otomatik',
    condition_type: 'İkinci El', kilometer: 0, body_type: 'Sedan', engine_power: '150 HP',
    engine_capacity: '1600 cc', drive_type: 'Önden Çekiş', color: 'Beyaz', damage_record: 'Boyasız',
    seller_type: 'Sahibinden', exchangeable: false, price: 0, city: 'İstanbul', district: 'Kadıköy',
    description: '', photos: [] as string[], show_phone: true
  };

  constructor(private http: HttpClient, private router: Router, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    // sessionStorage kullanıldı
    const savedUser = sessionStorage.getItem('currentUser');
    if (savedUser) {
      try {
        this.currentUser = JSON.parse(savedUser);
      } catch (e) {
        console.error('Kullanıcı verisi okunamadı', e);
      }
    }

    if (!this.currentUser || !this.currentUser.id) {
      this.router.navigate(['/login']);
      return;
    }

    this.http.get<any>(`http://localhost:3000/api/users/${this.currentUser.id}`).subscribe({
      next: (userRes) => {
        if (userRes) {
          this.currentUser = userRes;
          sessionStorage.setItem('currentUser', JSON.stringify(this.currentUser));
          this.loadFriends();
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Kullanıcı bilgisi çekilemedi', err);
        this.logout();
      }
    });

    this.loadListings();
    this.loadFavorites();
    this.loadFriends();
  }

  searchNavUsers() {
    if (!this.navUserSearchQuery.trim()) return;
    this.http.get<any[]>(`http://localhost:3000/api/users/search/${this.navUserSearchQuery}`).subscribe(res => {
      this.navSearchResults = res;
      this.cdr.detectChanges();
    });
  }

  openUserProfile(userId: number) {
    this.navSearchResults = [];
    this.navUserSearchQuery = '';
    this.selectedListing = null;
    this.http.get<any>(`http://localhost:3000/api/users/profile/${userId}`).subscribe(res => {
      this.viewedUserProfile = res.user;
      this.viewedUserListings = res.listings;
      this.activeTab = 'user-profile';
      this.cdr.detectChanges();
    });
  }

  addFriendFromProfile(userId: number) {
    this.http.post('http://localhost:3000/api/friends', { user_id: this.currentUser.id, friend_id: userId }).subscribe(() => {
      alert('Kişi başarıyla arkadaş olarak eklendi!');
      this.loadFriends();
    });
  }

  startChatWithUserProfile(user: any) {
    this.activeChatUser = user;
    this.activeTab = 'messages';
    this.loadMessagesList();
    this.filterActiveChatMessages();
  }

  onBrandChange() {
    this.availableModels = this.brandModels[this.selectedBrand] || [];
    this.selectedModel = '';
    this.loadListings();
  }

  onModalBrandChange() {
    this.availableModalModels = this.brandModels[this.newListingData.brand] || [];
    this.newListingData.model = '';
  }

  loadListings() {
    let url = 'http://localhost:3000/api/listings?';
    let params: string[] = [];
    if (this.activeTab === 'my-listings') params.push(`user_id=${this.currentUser.id}`);
    if (this.selectedCity) params.push(`city=${this.selectedCity}`);
    if (this.selectedBrand) params.push(`brand=${this.selectedBrand}`);
    if (this.selectedModel) params.push(`model=${this.selectedModel}`);

    this.http.get<any[]>(url + params.join('&')).subscribe(res => {
      this.listings = res;
      this.cdr.detectChanges();
    });
  }

  loadFavorites() {
    if (!this.currentUser.id) return;
    this.http.get<any[]>(`http://localhost:3000/api/favorites/${this.currentUser.id}`).subscribe(res => {
      this.favoriteIds = res.map(f => f.id);
      if (this.activeTab === 'favorites') this.listings = res;
      this.cdr.detectChanges();
    });
  }

  loadFriends() {
    if (!this.currentUser.id) return;
    this.http.get<any[]>(`http://localhost:3000/api/friends/${this.currentUser.id}`).subscribe(res => {
      this.friendsList = res;
      this.cdr.detectChanges();
    });
  }

  searchUsers() {
    if (!this.friendSearchQuery.trim()) return;
    this.http.get<any[]>(`http://localhost:3000/api/users/search/${this.friendSearchQuery}`).subscribe(res => {
      this.searchResults = res.filter(u => u.id !== this.currentUser.id);
      this.cdr.detectChanges();
    });
  }

  addFriend(friendId: number) {
    this.http.post('http://localhost:3000/api/friends', { user_id: this.currentUser.id, friend_id: friendId }).subscribe(() => {
      alert('Arkadaş eklendi!');
      this.loadFriends();
      this.searchResults = [];
      this.friendSearchQuery = '';
    });
  }

  removeFriend(friendId: number) {
    if (confirm('Bu kişiyi arkadaşlıktan çıkarmak istediğinize emin misiniz?')) {
      this.http.delete(`http://localhost:3000/api/friends/${this.currentUser.id}/${friendId}`).subscribe(() => {
        alert('Arkadaşlıktan çıkarıldı.');
        this.loadFriends();
      });
    }
  }

  switchTab(tab: any) {
    this.selectedListing = null;
    this.activeTab = tab;
    if (tab === 'favorites') this.loadFavorites();
    else if (tab === 'messages') this.loadMessagesList();
    else if (tab === 'friends') this.loadFriends();
    else if (tab !== 'settings' && tab !== 'user-profile') this.loadListings();
    this.cdr.detectChanges();
  }

  applyFilters() { this.loadListings(); }

  resetFilters() {
    this.selectedCity = ''; this.selectedBrand = ''; this.selectedModel = '';
    this.availableModels = [];
    this.loadListings();
  }

  toggleFavorite(listingId: number) {
    this.http.post('http://localhost:3000/api/favorites', { user_id: this.currentUser.id, listing_id: listingId }).subscribe(() => this.loadFavorites());
  }

  isFavorite(listingId: number): boolean { return this.favoriteIds.includes(listingId); }

  onPhotoSelected(event: any) {
    const files = event.target.files;
    if (files) {
      for (let file of files) {
        const reader = new FileReader();
        reader.onload = (e: any) => { this.newListingData.photos.push(e.target.result); this.cdr.detectChanges(); };
        reader.readAsDataURL(file);
      }
    }
  }

  removePhoto(index: number) { this.newListingData.photos.splice(index, 1); }

  createListing() {
    const payload = { ...this.newListingData, user_id: this.currentUser.id };
    this.http.post('http://localhost:3000/api/listings', payload).subscribe(() => {
      alert('İlan yayınlandı!');
      this.showAddModal = false;
      this.newListingData.photos = [];
      this.loadListings();
    });
  }

  toggleFeatured(listing: any) {
    listing.is_featured = !listing.is_featured;
    this.http.put(`http://localhost:3000/api/listings/${listing.id}`, listing).subscribe(() => this.loadListings());
  }

  updateListingStatus(listing: any, newStatus: string) {
    listing.status = newStatus;
    this.http.put(`http://localhost:3000/api/listings/${listing.id}`, listing).subscribe(() => this.loadListings());
  }

  deleteListing(id: number) {
    if (confirm('Silmek istediğinize emin misiniz?')) {
      this.http.delete(`http://localhost:3000/api/listings/${id}`).subscribe(() => this.loadListings());
    }
  }

  openDetail(item: any) {
    this.selectedListing = item;
    this.activeImageIndex = 0;
    this.loadComments(item.id);
  }

  loadComments(listingId: number) {
    this.http.get<any[]>(`http://localhost:3000/api/comments/${listingId}`).subscribe(res => {
      this.listingComments = res;
      this.cdr.detectChanges();
    });
  }

  addComment() {
    if (!this.newCommentText.trim()) return;
    const payload = { listing_id: this.selectedListing.id, user_id: this.currentUser.id, comment: this.newCommentText };
    this.http.post('http://localhost:3000/api/comments', payload).subscribe(() => {
      this.newCommentText = '';
      this.loadComments(this.selectedListing.id);
    });
  }

  addReply(comment: any) {
    if (!comment.replyText || !comment.replyText.trim()) return;
    const payload = { comment_id: comment.id, user_id: this.currentUser.id, reply: comment.replyText };
    this.http.post('http://localhost:3000/api/comment-replies', payload).subscribe(() => {
      comment.replyText = '';
      comment.showReplyInput = false;
      this.loadComments(this.selectedListing.id);
    });
  }

  sendDirectMessage(listing: any) {
    if (!this.directMessageText.trim()) return;
    const payload = { sender_id: this.currentUser.id, receiver_id: listing.user_id, listing_id: listing.id, message: this.directMessageText };
    this.http.post('http://localhost:3000/api/messages', payload).subscribe(() => {
      alert('Mesajınız ilan sahibine iletildi!');
      this.directMessageText = '';
      this.switchTab('messages');
    });
  }

  loadMessagesList() {
    this.http.get<any[]>(`http://localhost:3000/api/messages/${this.currentUser.id}`).subscribe(res => {
      this.messages = res;
      if (this.activeChatUser) {
        this.filterActiveChatMessages();
      }
      this.cdr.detectChanges();
    });
  }

  startChatWithFriend(friend: any) {
    this.activeChatUser = friend;
    this.activeTab = 'messages';
    this.loadMessagesList();
    this.filterActiveChatMessages();
  }

  selectChatUser(msg: any) {
    const otherId = msg.sender_id === this.currentUser.id ? msg.receiver_id : msg.sender_id;
    const otherName = msg.sender_id === this.currentUser.id ? msg.receiver_name : msg.sender_name;
    const otherAvatar = msg.sender_id === this.currentUser.id ? msg.receiver_avatar : msg.sender_avatar;
    this.activeChatUser = { id: otherId, name: otherName, profile_image: otherAvatar };
    this.filterActiveChatMessages();
  }

  filterActiveChatMessages() {
    if (!this.activeChatUser) return;
    this.http.get<any[]>(`http://localhost:3000/api/messages/${this.currentUser.id}`).subscribe(res => {
      this.messages = res;
      this.activeChatMessages = res.filter(m =>
        (m.sender_id === this.currentUser.id && m.receiver_id === this.activeChatUser.id) ||
        (m.sender_id === this.activeChatUser.id && m.receiver_id === this.currentUser.id)
      );
      this.cdr.detectChanges();
    });
  }

  sendChatMessage() {
    if (!this.messengerInputText.trim() || !this.activeChatUser) return;
    const payload = { sender_id: this.currentUser.id, receiver_id: this.activeChatUser.id, message: this.messengerInputText };
    this.http.post('http://localhost:3000/api/messages', payload).subscribe(() => {
      this.messengerInputText = '';
      this.filterActiveChatMessages();
      this.loadMessagesList();
    });
  }

  updateProfile() {
    this.http.put(`http://localhost:3000/api/users/${this.currentUser.id}`, this.currentUser).subscribe((res: any) => {
      alert('Profil bilgileriniz güncellendi!');
      this.currentUser = res.user;
      sessionStorage.setItem('currentUser', JSON.stringify(this.currentUser));
      this.cdr.detectChanges();
    });
  }

  logout() {
    sessionStorage.removeItem('currentUser');
    this.router.navigate(['/login']);
  }

  onProfilePhotoSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.currentUser.profile_image = e.target.result;
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    }
  }
}
