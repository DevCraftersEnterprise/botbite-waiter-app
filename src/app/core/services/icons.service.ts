import { Injectable } from '@angular/core';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Banknote,
  CirclePlus,
  CreditCard,
  FileText,
  ReceiptText,
  Timer,
  TriangleAlert,
  Download,
  Hand,
  House,
  LayoutList,
  LogOut,
  MapPin,
  Menu,
  MessagesSquare,
  NotebookPen,
  Pen,
  Power,
  QrCode,
  ScrollText,
  Search,
  ShieldCheck,
  ShieldOff,
  ShieldPlus,
  ShieldX,
  StarIcon,
  Upload,
  UserPlus,
  Users,
  Utensils,
  Eye,
  FileUp,
  FileDown,
  CircleAlert,
  Heart,
  HeartOff,
  Image,
  Bell,
  MessageCircle,
} from 'lucide-angular';

@Injectable({
  providedIn: 'root',
})
export class IconsService {
  readonly logout = LogOut;
  readonly power = Power;
  readonly menu = Menu;
  readonly house = House;
  readonly users = Users;
  readonly categories = StarIcon;
  readonly restaurants = Utensils;
  readonly branches = MapPin;
  readonly products = LayoutList;
  readonly download = Download;
  readonly orders = ScrollText;
  readonly bill = ReceiptText;
  readonly cash = Banknote;
  readonly card = CreditCard;
  readonly alert = TriangleAlert;
  readonly invoice = FileText;
  readonly timer = Timer;
  readonly message = MessagesSquare;
  readonly assistant = Bot;
  readonly hand = Hand;
  readonly addUser = UserPlus;
  readonly search = Search;
  readonly active = ShieldCheck;
  readonly inactive = ShieldX;
  readonly next = ArrowRight;
  readonly previous = ArrowLeft;
  readonly add = CirclePlus;
  readonly edit = Pen;
  readonly disable = ShieldOff;
  readonly addRole = ShieldPlus;
  readonly qrCode = QrCode;
  readonly upload = Upload;
  readonly menus = NotebookPen;
  readonly eye = Eye;
  readonly uploadFile = FileUp;
  readonly downloadFile = FileDown;
  readonly alertCircle = CircleAlert;
  readonly favorite = Heart;
  readonly dislike = HeartOff;
  readonly image = Image;
  readonly bell = Bell;
  readonly whatsapp = MessageCircle;
}
